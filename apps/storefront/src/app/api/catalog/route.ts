import { NextRequest, NextResponse } from 'next/server'
import { catalogData } from '@lib/nord/data'

export async function GET(request: NextRequest) {
  try {
    const result = await catalogData(request.nextUrl.searchParams)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (reason) {
    const status = reason instanceof Error && 'status' in reason && typeof reason.status === 'number' ? reason.status : 502
    return NextResponse.json({ message: status < 500 ? 'Проверьте параметры каталога.' : 'Не удалось загрузить товары. Попробуйте ещё раз.' }, { status })
  }
}
