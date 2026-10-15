import { spawn } from 'node:child_process'
import { constants } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const windows = process.platform === 'win32'
export const signalExitCode = (signal) => 128 + (constants.signals[signal] || 1)
export const childExitCode = (result) =>
  result.error ? 1 : result.signal ? signalExitCode(result.signal) : (result.code ?? 1)

export function startProcess(command, args, options = {}) {
  const child = spawn(command, args, { stdio: 'inherit', ...options, detached: !windows })
  let exited = false
  let spawnError
  let stopping
  const completion = new Promise((resolve) => {
    child.once('error', (error) => {
      spawnError = error
    })
    child.once('exit', () => {
      exited = true
    })
    child.once('close', (code, signal) => resolve({ code, signal, error: spawnError }))
  })
  const groupExists = () => {
    try {
      process.kill(-child.pid, 0)
      return true
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
      return false
    }
  }
  const signalGroup = (signal) => {
    try {
      process.kill(-child.pid, signal)
    } catch (error) {
      if (error.code !== 'ESRCH') throw error
    }
  }
  async function terminate(signal) {
    if (!child.pid) return completion
    if (windows) {
      // Do not target a PID after its child's exit: Windows can reuse it.
      if (!exited && child.exitCode === null && child.signalCode === null) {
        await new Promise((resolve, reject) => {
          const killer = spawn(
            path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe'),
            ['/PID', String(child.pid), '/T', '/F'],
            { stdio: 'ignore', windowsHide: true },
          )
          killer.once('error', reject)
          killer.once('close', (code) => {
            if (code === 0 || exited || child.exitCode !== null || child.signalCode !== null)
              resolve()
            else
              reject(
                new Error(`Не удалось завершить дерево процесса ${child.pid}: taskkill ${code}.`),
              )
          })
        })
      }
    } else {
      // Every child owns a detached process group; never signal our own group.
      signalGroup(signal)
      const deadline = Date.now() + 4000
      while (groupExists() && Date.now() < deadline) await delay(40)
      if (groupExists()) signalGroup('SIGKILL')
    }
    await completion
  }
  return { completion, stop: (signal = 'SIGTERM') => (stopping ||= terminate(signal)) }
}

export async function runProcess(command, args, options = {}) {
  const task = startProcess(command, args, options)
  let receivedSignal
  let shutdown
  let shutdownError
  const onSignal = (signal) => {
    receivedSignal ||= signal
    shutdown ||= task.stop(signal).catch((error) => {
      shutdownError = error
    })
  }
  const interrupt = () => onSignal('SIGINT')
  const terminate = () => onSignal('SIGTERM')
  process.on('SIGINT', interrupt)
  process.on('SIGTERM', terminate)
  try {
    const result = await task.completion
    await (shutdown || task.stop())
    const code = receivedSignal ? signalExitCode(receivedSignal) : childExitCode(result)
    if (shutdownError) throw shutdownError
    if (code !== 0) {
      const error = new Error(
        result.error?.message ||
          `Команда ${path.basename(command)} завершилась: ${receivedSignal || result.signal || `код ${code}`}.`,
      )
      error.exitCode = code
      throw error
    }
  } finally {
    process.off('SIGINT', interrupt)
    process.off('SIGTERM', terminate)
  }
}
