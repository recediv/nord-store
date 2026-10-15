"use client"

import { ArrowRight, ArrowUpRight, Leaf, Sparkles, Timer } from "lucide-react"
import { money } from "@lib/nord/format"
import { StoreImage } from "@modules/nord/image"
import { Link } from "@modules/nord/link"
import { useNord } from "@modules/nord/provider"
import "./styles/info.css"

export function About() {
  return (
    <main className="container about-page">
      <div className="about-intro">
        <span className="eyebrow">НАША ИСТОРИЯ</span>
        <h1>
          Хорошо там,
          <br />
          где <em>вы дома.</em>
        </h1>
        <p>
          Мы верим, что уют складывается из простых вещей: удобного кресла,
          тёплого света, знакомой фактуры дерева. NORD помогает собрать
          пространство, в котором легко быть собой.
        </p>
      </div>
      <StoreImage
        className="about-photo"
        image="hero.jpg"
        sizes="(min-width: 1280px) 1200px, 94vw"
        alt="Дом с натуральными материалами и уютным освещением"
        width={1440}
        height={930}
        fetchPriority="high"
      />
      <div className="about-values">
        <article>
          <Leaf size={28} strokeWidth={1.3} aria-hidden="true" />
          <h2>Материалы с характером</h2>
          <p>
            Дерево, керамика, лён и хлопок. Фактуры, к которым хочется
            прикоснуться.
          </p>
        </article>
        <article>
          <Timer size={28} strokeWidth={1.3} aria-hidden="true" />
          <h2>Вне быстротечных трендов</h2>
          <p>
            Простые формы и спокойные оттенки остаются актуальными год за годом.
          </p>
        </article>
        <article>
          <Sparkles size={28} strokeWidth={1.3} aria-hidden="true" />
          <h2>Красота повседневного</h2>
          <p>
            Мы выбираем предметы, которые делают маленькие домашние ритуалы
            приятнее.
          </p>
        </article>
      </div>
      <aside className="about-demo" aria-labelledby="about-demo-title">
        <h2 id="about-demo-title">О демо-проекте</h2>
        <p>
          NORD — демонстрационный магазин на Medusa.js. Товары, характеристики,
          оценки, цены и адрес шоурума вымышлены. Фотографии используются для
          иллюстрации. Оформление не приводит к реальной покупке.
        </p>
      </aside>
      <Link className="button" href="/catalog">
        Найти своё <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </main>
  )
}

const rooms = [
  {
    name: "Гостиная без спешки",
    room: "Гостиная",
    text: "Мягкое кресло, тактильный плед и свет для долгих вечеров.",
    image: "hero.jpg",
  },
  {
    name: "Утро в своём ритме",
    room: "Спальня",
    text: "Лён, спокойные оттенки и немного тёплого света.",
    image: "bedding.jpg",
  },
  {
    name: "Больше поводов собраться",
    room: "Кухня",
    text: "Натуральное дерево, керамика и место для близких.",
    image: "table.jpg",
  },
  {
    name: "Место для новых идей",
    room: "Кабинет",
    text: "Открытые полки и продуманные детали рабочего места.",
    image: "shelf.jpg",
  },
]

export function Inspiration() {
  return (
    <main className="container inspiration-page">
      <div className="page-title">
        <span className="eyebrow">ВДОХНОВЕНИЕ РЯДОМ</span>
        <h1>Дом в вашем ритме</h1>
        <p>Четыре идеи для пространства, в котором хочется быть.</p>
      </div>
      <div className="inspiration-grid">
        {rooms.map((room, index) => (
          <Link
            href={`/catalog?room=${encodeURIComponent(room.room)}`}
            key={room.room}
          >
            <div>
              <StoreImage
                image={room.image}
                alt={room.name}
                sizes="(min-width: 1280px) 585px, (min-width: 601px) 46vw, 94vw"
                width={800}
                height={600}
                loading={index === 0 ? "eager" : "lazy"}
              />
              <span aria-hidden="true">
                <ArrowUpRight size={23} />
              </span>
            </div>
            <h2>{room.name}</h2>
            <p>{room.text}</p>
            <small>
              Собрать свой образ <ArrowRight size={15} aria-hidden="true" />
            </small>
          </Link>
        ))}
      </div>
    </main>
  )
}

const helpContent: Record<string, { title: string; paragraphs: string[] }> = {
  delivery: {
    title: "Доставка и оплата",
    paragraphs: [
      "Доступные способы, сроки и точную стоимость доставки рассчитаем при оформлении заказа.",
      "В демо-магазине используется тестовая оплата. Деньги не списываются, реальная доставка не выполняется. Не вводите реквизиты настоящей банковской карты.",
    ],
  },
  returns: {
    title: "Обмен и возврат",
    paragraphs: [
      "Это описание демонстрационной политики магазина. Оно не является офертой и не создаёт условий реальной покупки.",
      "В реальном проекте обращения на возврат можно обрабатывать через административную панель Medusa.",
    ],
  },
  care: {
    title: "Чтобы любимые вещи служили дольше",
    paragraphs: [
      "Дерево: протирайте мягкой слегка влажной тканью. Не ставьте горячую посуду без подставки и избегайте длительного контакта с водой.",
      "Лён и хлопок: стирайте в деликатном режиме при температуре, указанной в карточке товара. Сушите естественным способом, вдали от прямого солнца.",
      "Керамика: избегайте резких перепадов температуры. Декоративные вазы лучше мыть вручную. Возможность машинной мойки проверяйте в характеристиках товара.",
      "Светильники: отключайте от сети перед чисткой. Используйте сухую ткань и лампы подходящей мощности.",
    ],
  },
  contacts: {
    title: "Будем на связи",
    paragraphs: [
      "Все адреса и контактные сведения в проекте приведены как примеры. Реального шоурума и службы поддержки у демо-магазина нет.",
      "В готовом магазине здесь можно подключить ваши контакты и поддержку покупателей.",
    ],
  },
  privacy: {
    title: "Данные в демо-магазине",
    paragraphs: [
      "Браузер сохраняет избранное, недавно просмотренные товары, выбранный город и данные, необходимые для восстановления корзины. Вы можете удалить их в настройках браузера.",
      "Используйте вымышленные имя, телефон, email и адрес для демонстрации оформления заказа.",
      "В проекте нет сторонних аналитических счётчиков. Фотографии и шрифты поставляются вместе с витриной.",
    ],
  },
}

export function Help({ topic }: { topic: string }) {
  const { config, mode } = useNord()
  const content = Object.hasOwn(helpContent, topic)
    ? helpContent[topic]
    : undefined
  if (!content) return <NotFound />
  const showroom = `${config.showroom.city}, ${config.showroom.address}. ${config.showroom.hours}`
  let paragraphs = content.paragraphs
  if (topic === "delivery") {
    paragraphs = [
      content.paragraphs[0],
      ...(config.freeShippingFrom
        ? [
            `По доступным стандартным тарифам — бесплатно от ${money(config.freeShippingFrom)} после скидок. Доступность доставки зависит от адреса и состава заказа.`,
          ]
        : []),
      `Демо-шоурум: ${showroom}`,
      ...content.paragraphs.slice(1),
    ]
  } else if (topic === "returns") {
    paragraphs = [
      `Товар можно вернуть в течение ${config.returnDays} дней, сохранив его первоначальное состояние и упаковку.`,
      ...content.paragraphs,
    ]
  } else if (topic === "contacts") {
    paragraphs = [`Демо-шоурум: ${showroom}`, ...content.paragraphs]
  } else if (topic === "privacy") {
    paragraphs = [
      ...content.paragraphs.slice(0, 2),
      mode === "medusa"
        ? "При оформлении контактные данные и адрес передаются вашему backend Medusa и сохраняются в заказе. Для работы с реальными покупателями потребуется ваша политика конфиденциальности."
        : "В автономной демке контактные данные не отправляются на сервер. Корзина и подтверждения демо-заказов хранятся в браузере.",
      ...content.paragraphs.slice(2),
    ]
  }
  return (
    <main className="container help-page">
      <nav className="breadcrumbs" aria-label="Хлебные крошки">
        <ol>
          <li>
            <Link href="/">NORD</Link>
          </li>
          <li aria-current="page">{content.title}</li>
        </ol>
      </nav>
      <h1>{content.title}</h1>
      {paragraphs.map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <Link className="button button-outline" href="/catalog">
        Вернуться в магазин <ArrowRight size={17} aria-hidden="true" />
      </Link>
    </main>
  )
}

export function NotFound() {
  return (
    <main className="container empty-state page-empty">
      <span className="not-found-number" aria-hidden="true">
        404
      </span>
      <h1>Немного не туда</h1>
      <p>Этой страницы нет. Но ваши любимые вещи где-то рядом.</p>
      <Link className="button" href="/">
        На главную <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </main>
  )
}
