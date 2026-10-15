"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import type { HttpTypes } from "@medusajs/types"
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
} from "lucide-react"
import type { CheckoutDetails, CheckoutOptions } from "@lib/nord/types"
import { money } from "@lib/nord/format"
import { Link } from "./link"
import { StoreImage } from "./image"
import { useNord } from "./provider"
import { CartError, CartSkeleton, PromoCode, cartLineInfo } from "./cart"
import "./styles/checkout.css"

const emptyOptions: CheckoutOptions = { shipping: [], payment: [] }
const cityChangeNotice =
  "Город изменился. Проверьте адрес и повторно рассчитайте доставку."
type Details = Omit<CheckoutDetails, "city">
type OptionsState = {
  key: string
  options: CheckoutOptions
  pending: boolean
  error: string
}

function savedDetails(cart: HttpTypes.StoreCart | null): Details {
  const address = cart?.shipping_address
  return {
    firstName: address?.first_name || "",
    lastName: address?.last_name || "",
    email: cart?.email || "",
    phone: address?.phone || "",
    address: address?.address_1 || "",
    postalCode: address?.postal_code || "",
    delivery: "standard",
    shippingOptionId: cart?.shipping_methods?.[0]?.shipping_option_id,
  }
}

function scrollToStart() {
  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth",
  })
}

export function Checkout({
  initialOptions,
}: {
  initialOptions?: CheckoutOptions
}) {
  const {
    cart,
    config,
    city,
    setCity,
    pending,
    storageReady,
    cartError,
    recovery,
    recovering,
    mode,
    getCheckoutOptions,
    prepareCheckout,
    completeCheckout,
  } = useNord()
  const items = cart?.items || []
  const address = cart?.shipping_address
  const orderKey = JSON.stringify([
    cart?.id,
    cart?.region_id,
    items.map((item) => [
      item.id,
      item.variant_id,
      item.quantity,
      item.unit_price,
    ]),
    cart?.promotions?.map((promotion) => [promotion.id, promotion.code]),
  ])
  const addressKey = JSON.stringify([
    address?.country_code,
    address?.province,
    address?.city,
    address?.postal_code,
    address?.address_1,
    address?.address_2,
  ])
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${orderKey}|${addressKey}|${cart?.item_total}|${cart?.original_item_total}|${attempt}`
  const [optionsState, setOptionsState] = useState<OptionsState>(() => ({
    key: requestKey,
    options: initialOptions || emptyOptions,
    pending: !initialOptions,
    error: "",
  }))
  const [step, setStep] = useState(1)
  const [details, setDetails] = useState<Details>(() => savedDetails(cart))
  const [paymentId, setPaymentId] = useState("")
  const [mustChooseShipping, setMustChooseShipping] = useState(false)
  const [preparedCity, setPreparedCity] = useState("")
  const [consent, setConsent] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const hydratedCart = useRef<string | null>(cart?.id || null)
  const fieldsTouched = useRef(false)
  const currentCity = useRef(city)
  currentCity.current = city
  const preparedOrder = useRef("")
  const initialKey = useRef(initialOptions ? requestKey : "")
  const loadOptions = useRef(getCheckoutOptions)
  loadOptions.current = getCheckoutOptions
  const ready = !!cart?.id && items.length > 0 && !recovery && !preparing

  useEffect(() => {
    if (!cart || hydratedCart.current === cart.id || fieldsTouched.current)
      return
    hydratedCart.current = cart.id
    setDetails(savedDetails(cart))
  }, [cart])

  useEffect(() => {
    if (!ready) return
    if (initialKey.current === requestKey) {
      initialKey.current = ""
      return
    }
    const controller = new AbortController()
    setOptionsState((previous) => ({
      ...previous,
      key: requestKey,
      pending: true,
      error: "",
    }))
    void loadOptions
      .current(controller.signal)
      .then((options) => {
        if (!controller.signal.aborted)
          setOptionsState({
            key: requestKey,
            options,
            pending: false,
            error: "",
          })
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setOptionsState((previous) => ({
            ...previous,
            key: requestKey,
            pending: false,
            error:
              reason instanceof Error
                ? reason.message
                : "Не удалось рассчитать доставку. Попробуйте ещё раз.",
          }))
      })
    return () => controller.abort()
  }, [ready, requestKey])

  const optionsPending =
    ready && (optionsState.key !== requestKey || optionsState.pending)
  const optionsError =
    !recovery && optionsState.key === requestKey ? optionsState.error : ""
  const optionsFresh = ready && !optionsPending && !optionsError
  const shippingOptions = optionsState.options.shipping
  const paymentOptions = optionsState.options.payment
  const selectedShipping =
    shippingOptions.find((option) => option.id === details.shippingOptionId) ||
    (!mustChooseShipping && !details.shippingOptionId
      ? shippingOptions.find((option) => option.code === details.delivery) ||
        shippingOptions[0]
      : undefined)
  const selectedPayment =
    paymentOptions.find((provider) => provider.id === paymentId) ||
    paymentOptions[0]
  const delivery = selectedShipping?.code || details.delivery
  const cityChanged = step === 2 && city !== preparedCity
  const orderChanged =
    step === 2 && !!preparedOrder.current && preparedOrder.current !== orderKey
  const addressDirty =
    delivery !== "pickup" &&
    (city.trim() !== (address?.city || "").trim() ||
      details.address.trim() !== (address?.address_1 || "").trim() ||
      details.postalCode.trim() !== (address?.postal_code || "").trim())
  const blockedItems = items.some((item) => {
    const line = cartLineInfo(item, mode === "demo")
    return (
      line.unavailable || (line.stock !== null && item.quantity > line.stock)
    )
  })
  const busy = pending || preparing || placing
  const fieldsDisabled = busy || recovery || !cart
  const quoteKnown =
    step === 2 &&
    !cityChanged &&
    !orderChanged &&
    !recovery &&
    optionsFresh &&
    selectedShipping?.id === details.shippingOptionId &&
    cart?.shipping_methods?.some(
      (method) => method.shipping_option_id === details.shippingOptionId,
    )
  const loading = !cart && !cartError && !recovery && (pending || !storageReady)
  const originalItems = cart?.original_item_total ?? 0
  const itemTotal = cart?.item_total ?? 0
  const discount = Math.max(0, originalItems - itemTotal)

  useEffect(() => {
    if (!cityChanged && !orderChanged) return
    setStep(1)
    setConsent(false)
    setNotice(
      cityChanged
        ? cityChangeNotice
        : "Состав или стоимость корзины изменились. Проверьте доставку ещё раз.",
    )
  }, [cityChanged, orderChanged])

  useEffect(() => {
    if (!optionsFresh) return
    if (selectedPayment && selectedPayment.id !== paymentId)
      setPaymentId(selectedPayment.id)
    if (
      details.shippingOptionId &&
      !shippingOptions.some((option) => option.id === details.shippingOptionId)
    ) {
      setStep(1)
      setConsent(false)
      setMustChooseShipping(true)
      setDetails((previous) => ({
        ...previous,
        delivery: "standard",
        shippingOptionId: undefined,
      }))
      setNotice(
        "Условия доставки изменились. Выберите доступный вариант и продолжите оформление.",
      )
    }
  }, [
    optionsFresh,
    selectedPayment,
    paymentId,
    shippingOptions,
    details.shippingOptionId,
  ])

  function setField(name: keyof CheckoutDetails, value: string) {
    fieldsTouched.current = true
    if (name === "city") setCity(value)
    else setDetails((previous) => ({ ...previous, [name]: value }))
    setConsent(false)
    setNotice("")
    setError("")
  }

  async function continueCheckout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (
      fieldsDisabled ||
      blockedItems ||
      optionsPending ||
      (mustChooseShipping && shippingOptions.length > 0 && !selectedShipping)
    )
      return
    setError("")
    setNotice("")
    if (
      details.firstName.trim().length < 2 ||
      details.lastName.trim().length < 2
    ) {
      setError("Укажите имя и фамилию: не менее двух букв.")
      return
    }
    const phone = details.phone.replace(/\D/g, "")
    if (phone.length < 10 || phone.length > 15) {
      setError("Укажите телефон: от 10 до 15 цифр.")
      return
    }
    if (
      delivery !== "pickup" &&
      (city.trim().length < 2 ||
        details.address.trim().length < 5 ||
        !/^\d{6}$/.test(details.postalCode))
    ) {
      setError("Укажите город, адрес и шестизначный почтовый индекс.")
      return
    }
    const submittedCity = city
    const requested = selectedShipping
    setPreparing(true)
    setConsent(false)
    try {
      const options = await prepareCheckout({
        ...details,
        city: submittedCity,
        delivery,
        firstName: details.firstName.trim(),
        lastName: details.lastName.trim(),
        email: details.email.trim(),
        phone: details.phone.trim(),
        address: details.address.trim(),
        postalCode: details.postalCode.trim(),
        shippingOptionId: requested?.id,
      })
      setOptionsState({ key: requestKey, options, pending: false, error: "" })
      if (currentCity.current !== submittedCity) {
        setStep(1)
        setNotice(cityChangeNotice)
        return
      }
      const accepted = options.shipping.find(
        (option) => option.id === requested?.id,
      )
      if (!accepted) {
        setStep(1)
        setMustChooseShipping(true)
        setDetails((previous) => ({
          ...previous,
          delivery: "standard",
          shippingOptionId: undefined,
        }))
        setNotice(
          options.shipping.length
            ? "Адрес сохранён. Выберите доступный способ доставки и продолжите оформление."
            : "Адрес сохранён. Для него пока нет доступной доставки. Проверьте адрес или измените состав корзины.",
        )
        return
      }
      setDetails((previous) => ({
        ...previous,
        delivery: accepted.code,
        shippingOptionId: accepted.id,
      }))
      setMustChooseShipping(false)
      setPreparedCity(submittedCity)
      preparedOrder.current = orderKey
      setStep(2)
      scrollToStart()
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось подготовить заказ. Попробуйте ещё раз.",
      )
      setAttempt((value) => value + 1)
    } finally {
      setPreparing(false)
    }
  }

  async function placeOrder() {
    if (
      step !== 2 ||
      busy ||
      recovery ||
      !quoteKnown ||
      blockedItems ||
      !selectedPayment ||
      !consent ||
      cartError
    )
      return
    setError("")
    setPlacing(true)
    try {
      await completeCheckout(selectedPayment.id)
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Не удалось оформить заказ. Попробуйте ещё раз.",
      )
    } finally {
      setPlacing(false)
    }
  }

  const deliveryStatus = !recovery && (
    <>
      {optionsPending && (
        <p className="muted checkout-status" role="status">
          Обновляем способы доставки и оплаты…
        </p>
      )}
      {optionsError && (
        <p className="form-error checkout-status" role="alert">
          {optionsError}{" "}
          <button
            type="button"
            className="text-link"
            disabled={busy}
            onClick={() => setAttempt((value) => value + 1)}
          >
            Повторить расчёт
          </button>
        </p>
      )}
      {optionsFresh && !shippingOptions.length && (
        <p className="form-error checkout-status" role="status">
          Для этой корзины и адреса пока нет доступной доставки. Укажите другой
          адрес и повторите расчёт.
        </p>
      )}
    </>
  )

  if (!items.length && !loading && !cartError && !recovery)
    return (
      <main className="container empty-state page-empty">
        <Package size={45} aria-hidden="true" />
        <h1>Сначала выберите любимые вещи</h1>
        <p>Добавьте товары в корзину, чтобы оформить заказ.</p>
        <Link className="button" href="/catalog">
          В каталог <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </main>
    )

  return (
    <main className="container checkout-page">
      <Link className="text-link back-link" href="/cart">
        <ArrowLeft size={16} aria-hidden="true" />В корзину
      </Link>
      <div className="page-title">
        <span className="eyebrow">ОСТАЛОСЬ СОВСЕМ НЕМНОГО</span>
        <h1>Оформление заказа</h1>
      </div>
      <CartError />
      {recovery && (
        <p className="cart-recovery-notice" role="status">
          {recovering
            ? "Проверяем результат оформления…"
            : "Результат оформления уточняется. Используйте проверку статуса заказа в сообщении вверху страницы."}
        </p>
      )}
      {blockedItems && (
        <p className="form-error" role="status">
          В корзине есть недоступные товары или превышено доступное количество.{" "}
          <Link href="/cart" className="text-link">
            Исправить корзину
          </Link>
        </p>
      )}
      {loading ? (
        <CartSkeleton rows={2} />
      ) : !cart ? null : (
        <>
          <div className="checkout-steps" aria-label="Этапы оформления">
            <span
              className={step === 1 ? "active" : "complete"}
              aria-current={step === 1 ? "step" : undefined}
            >
              <i>{step > 1 ? <Check size={14} aria-hidden="true" /> : "1"}</i>
              Доставка
            </span>
            <span className="step-line" aria-hidden="true" />
            <span
              className={step === 2 ? "active" : ""}
              aria-current={step === 2 ? "step" : undefined}
            >
              <i>2</i>Оплата и подтверждение
            </span>
          </div>
          <div className="checkout-layout">
            <div className="checkout-form">
              {step === 1 ? (
                <form onSubmit={continueCheckout}>
                  <fieldset
                    disabled={fieldsDisabled}
                    className="checkout-fields"
                  >
                    <legend className="sr-only">Контакты и доставка</legend>
                    <h2>Познакомимся?</h2>
                    <p className="muted">Укажите контакты для вашего заказа.</p>
                    <div className="form-grid">
                      <label>
                        Имя
                        <input
                          name="firstName"
                          type="text"
                          autoComplete="given-name"
                          required
                          minLength={2}
                          maxLength={60}
                          value={details.firstName}
                          onChange={(event) =>
                            setField("firstName", event.target.value)
                          }
                          placeholder="Анна"
                        />
                      </label>
                      <label>
                        Фамилия
                        <input
                          name="lastName"
                          type="text"
                          autoComplete="family-name"
                          required
                          minLength={2}
                          maxLength={60}
                          value={details.lastName}
                          onChange={(event) =>
                            setField("lastName", event.target.value)
                          }
                          placeholder="Иванова"
                        />
                      </label>
                      <label>
                        Email
                        <input
                          name="email"
                          type="email"
                          autoComplete="email"
                          required
                          maxLength={254}
                          value={details.email}
                          onChange={(event) =>
                            setField("email", event.target.value)
                          }
                          placeholder="anna@example.com"
                        />
                      </label>
                      <label>
                        Телефон
                        <input
                          name="phone"
                          type="tel"
                          autoComplete="tel"
                          required
                          maxLength={25}
                          value={details.phone}
                          onChange={(event) =>
                            setField("phone", event.target.value)
                          }
                          placeholder="+7 999 123-45-67"
                        />
                      </label>
                    </div>
                    <h2
                      id="checkout-delivery-title"
                      className="form-section-heading"
                    >
                      Как вам удобнее?
                    </h2>
                    <div
                      className="delivery-options"
                      role="radiogroup"
                      aria-labelledby="checkout-delivery-title"
                    >
                      {!shippingOptions.length && optionsPending && (
                        <CartSkeleton rows={2} />
                      )}
                      {shippingOptions.map((option) => {
                        const Icon =
                          option.code === "pickup"
                            ? MapPin
                            : option.code === "express"
                              ? Package
                              : Truck
                        const selected = selectedShipping?.id === option.id
                        return (
                          <label
                            key={option.id}
                            className={`delivery-option${selected ? " selected" : ""}`}
                          >
                            <input
                              type="radio"
                              name="delivery"
                              value={option.id}
                              checked={selected}
                              disabled={
                                fieldsDisabled ||
                                optionsPending ||
                                !!optionsError
                              }
                              onChange={() => {
                                setDetails((previous) => ({
                                  ...previous,
                                  delivery: option.code,
                                  shippingOptionId: option.id,
                                }))
                                setMustChooseShipping(false)
                                setConsent(false)
                                setError("")
                                setNotice("")
                              }}
                            />
                            <Icon
                              size={22}
                              strokeWidth={1.5}
                              aria-hidden="true"
                            />
                            <span>
                              <strong>{option.name}</strong>
                              <small>{option.description}</small>
                            </span>
                            <b>
                              {optionsPending ||
                              optionsError ||
                              (addressDirty && option.code !== "pickup")
                                ? "После расчёта"
                                : option.amount
                                  ? money(option.amount)
                                  : "Бесплатно"}
                            </b>
                          </label>
                        )
                      })}
                    </div>
                    {deliveryStatus}
                    {delivery !== "pickup" && (
                      <>
                        <h2 className="form-section-heading">Куда привезти?</h2>
                        <div className="form-grid">
                          <label>
                            Город
                            <input
                              name="city"
                              type="text"
                              autoComplete="address-level2"
                              required
                              minLength={2}
                              maxLength={100}
                              value={city}
                              onChange={(event) =>
                                setField("city", event.target.value)
                              }
                            />
                          </label>
                          <label>
                            Почтовый индекс
                            <input
                              name="postalCode"
                              type="text"
                              inputMode="numeric"
                              autoComplete="postal-code"
                              required
                              pattern="[0-9]{6}"
                              title="Шесть цифр почтового индекса"
                              maxLength={6}
                              value={details.postalCode}
                              onChange={(event) =>
                                setField("postalCode", event.target.value)
                              }
                              placeholder="630000"
                            />
                          </label>
                          <label className="full-field">
                            Улица, дом, квартира
                            <input
                              name="address"
                              type="text"
                              autoComplete="address-line1"
                              required
                              minLength={5}
                              maxLength={150}
                              value={details.address}
                              onChange={(event) =>
                                setField("address", event.target.value)
                              }
                              placeholder="ул. Советская, д. 10, кв. 5"
                            />
                          </label>
                        </div>
                      </>
                    )}
                  </fieldset>
                  {error && !recovery && (
                    <p className="form-error checkout-status" role="alert">
                      {error}
                    </p>
                  )}
                  {notice && !recovery && (
                    <p className="muted checkout-status" role="status">
                      {notice}
                    </p>
                  )}
                  <button
                    className="button checkout-continue"
                    type="submit"
                    disabled={
                      fieldsDisabled ||
                      blockedItems ||
                      optionsPending ||
                      !!cartError ||
                      (mustChooseShipping &&
                        shippingOptions.length > 0 &&
                        !selectedShipping)
                    }
                    aria-busy={preparing}
                  >
                    {preparing
                      ? "Проверяем доставку…"
                      : recovery
                        ? "Статус заказа уточняется"
                        : selectedShipping && !optionsError
                          ? "Продолжить"
                          : "Рассчитать доставку"}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </form>
              ) : (
                <div>
                  <h2>Всё почти готово</h2>
                  <div className="checkout-address">
                    <div>
                      <strong>
                        {details.firstName} {details.lastName}
                      </strong>
                      <p>
                        {details.email}
                        <br />
                        {details.phone}
                      </p>
                      <p>
                        {delivery === "pickup"
                          ? `Самовывоз: ${config.showroom.city}, ${config.showroom.address}`
                          : `${city}, ${details.address}, ${details.postalCode}`}
                      </p>
                      <p>{selectedShipping?.name}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy || recovery}
                      onClick={() => {
                        setStep(1)
                        setConsent(false)
                        setError("")
                      }}
                    >
                      Изменить
                    </button>
                  </div>
                  <h2
                    id="checkout-payment-title"
                    className="form-section-heading"
                  >
                    Способ оплаты
                  </h2>
                  {deliveryStatus}
                  {optionsFresh && !paymentOptions.length && (
                    <p className="form-error checkout-status" role="status">
                      Для этой корзины нет доступных способов оплаты.{" "}
                      <button
                        type="button"
                        className="text-link"
                        disabled={busy}
                        onClick={() => setAttempt((value) => value + 1)}
                      >
                        Повторить расчёт
                      </button>
                    </p>
                  )}
                  <div
                    role="radiogroup"
                    aria-labelledby="checkout-payment-title"
                  >
                    {paymentOptions.map((provider) => (
                      <label
                        key={provider.id}
                        className={`payment-option${selectedPayment?.id === provider.id ? " selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="payment"
                          value={provider.id}
                          checked={selectedPayment?.id === provider.id}
                          disabled={
                            fieldsDisabled || optionsPending || !!optionsError
                          }
                          onChange={() => setPaymentId(provider.id)}
                        />
                        <CreditCard size={24} aria-hidden="true" />
                        <span>
                          <strong>{provider.name}</strong>
                          {(provider.id === "pp_system_default" ||
                            mode === "demo") && (
                            <small>Деньги не списываются, карта не нужна</small>
                          )}
                        </span>
                        <ShieldCheck size={19} aria-hidden="true" />
                      </label>
                    ))}
                  </div>
                  <p className="demo-checkout-note">
                    {mode === "demo"
                      ? "Это демонстрационный заказ. Он сохранится только в этом браузере."
                      : "Заказ будет создан в Medusa с тестовым провайдером оплаты."}{" "}
                    Реальная доставка не выполняется.
                  </p>
                  <label className="check-label consent">
                    <input
                      type="checkbox"
                      disabled={fieldsDisabled}
                      checked={consent}
                      onChange={(event) => setConsent(event.target.checked)}
                    />
                    <span>
                      Я согласен с{" "}
                      <Link
                        href="/help/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        условиями обработки данных
                      </Link>{" "}
                      и понимаю, что заказ демонстрационный.
                    </span>
                  </label>
                  {error && !recovery && (
                    <p className="form-error checkout-status" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    type="button"
                    className="button full checkout-continue"
                    onClick={() => void placeOrder()}
                    disabled={
                      busy ||
                      recovery ||
                      !quoteKnown ||
                      blockedItems ||
                      !!cartError ||
                      !consent ||
                      !selectedPayment
                    }
                    aria-busy={placing}
                  >
                    {placing
                      ? "Оформляем заказ…"
                      : recovery
                        ? "Статус заказа уточняется"
                        : `Оформить демо-заказ · ${quoteKnown ? money(cart.total) : "…"}`}
                    <ArrowRight size={18} aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
            <aside
              className="order-summary"
              aria-labelledby="checkout-summary-title"
            >
              <h2 id="checkout-summary-title">
                Ваш выбор{" "}
                <span>
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              </h2>
              <div className="checkout-items">
                {items.map((item) => {
                  const line = cartLineInfo(item, mode === "demo")
                  return (
                    <div key={item.id}>
                      {line.image ? (
                        <StoreImage
                          image={line.image}
                          preset="thumbnail"
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span
                          className="cart-image-placeholder"
                          aria-hidden="true"
                        >
                          <Package size={24} />
                        </span>
                      )}
                      <span>
                        <strong>{line.name}</strong>
                        <small>
                          {line.color ? `${line.color} · ` : ""}
                          {item.quantity} шт.
                        </small>
                        {line.unavailable && (
                          <small>Товар больше недоступен</small>
                        )}
                      </span>
                      <b>{money(line.total)}</b>
                    </div>
                  )
                })}
              </div>
              {step === 1 && <PromoCode />}
              <div className="summary-row">
                <span>Товары</span>
                <span>{money(originalItems)}</span>
              </div>
              {discount > 0 && (
                <div className="summary-row discount">
                  <span>Скидка</span>
                  <span>−{money(discount)}</span>
                </div>
              )}
              <div className="summary-row">
                <span>Доставка</span>
                <span>
                  {quoteKnown
                    ? cart.shipping_total
                      ? money(cart.shipping_total)
                      : "Бесплатно"
                    : "Рассчитывается"}
                </span>
              </div>
              <div className="summary-row grand-total">
                <strong>Итого</strong>
                <strong>{quoteKnown ? money(cart.total) : "—"}</strong>
              </div>
              <p className="small-text muted summary-note">
                <ShieldCheck size={17} aria-hidden="true" />
                Демо-оформление без реальных платежей
              </p>
            </aside>
          </div>
        </>
      )}
    </main>
  )
}

export default Checkout
