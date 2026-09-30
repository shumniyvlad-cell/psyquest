export type ConsumableId = 'hint' | 'tea' | 'supervision'
export type RelicId =
  | 'shield_facts'
  | 'compass'
  | 'hammer'
  | 'gear'
  | 'crystal_echo'
  | 'horn'
  | 'calm_voice'
  | 'lantern_oil'

export interface ConsumableDef {
  id: ConsumableId
  name: string
  desc: string
  price: number
}

export interface RelicDef {
  id: RelicId
  name: string
  desc: string
  from: string
}

export const CONSUMABLES: Record<ConsumableId, ConsumableDef> = {
  hint: {
    id: 'hint',
    name: 'Перо Совы',
    desc: 'Подсказка: в бою подсвечивает сильный ответ, в мастерской — показывает пример.',
    price: 30,
  },
  tea: {
    id: 'tea',
    name: 'Ромашковый чай',
    desc: 'В бою возвращает 25 уверенности. Можно пить между репликами.',
    price: 20,
  },
  supervision: {
    id: 'supervision',
    name: 'Сеанс супервизии',
    desc: 'В бою полностью восстанавливает уверенность. Как в жизни.',
    price: 60,
  },
}

export const RELICS: Record<RelicId, RelicDef> = {
  shield_facts: {
    id: 'shield_facts',
    name: 'Щит фактов',
    desc: '+15 к уверенности в каждом бою. Сделан из твоего досье экспертизы.',
    from: 'Долина Сомнений',
  },
  compass: {
    id: 'compass',
    name: 'Компас ниши',
    desc: '+10% опыта за всё. Ясность экономит силы.',
    from: 'Лес Смыслов',
  },
  hammer: {
    id: 'hammer',
    name: 'Молот ценности',
    desc: '+15% к силе ответов в спорах о цене и ценности.',
    from: 'Кузница Продукта',
  },
  gear: {
    id: 'gear',
    name: 'Шестерёнка автоворонки',
    desc: '+1 заявка в каждый день запуска: бот работает, пока ты спишь.',
    from: 'Башня Ботов',
  },
  crystal_echo: {
    id: 'crystal_echo',
    name: 'Кристалл эха',
    desc: '+2 к харизме. Твой голос возвращается эхом.',
    from: 'Студия Эха',
  },
  horn: {
    id: 'horn',
    name: 'Рупор глашатая',
    desc: '+1 к харизме. О тебе начинают говорить.',
    from: 'Площадь Запуска',
  },
  calm_voice: {
    id: 'calm_voice',
    name: 'Голос спокойствия',
    desc: '+15% к шансу сильного попадания в любом споре.',
    from: 'Арена Продаж',
  },
  lantern_oil: {
    id: 'lantern_oil',
    name: 'Масло для фонаря',
    desc: '+2 к стойкости. Подарок тех, кто прошёл путь раньше.',
    from: 'Случайная находка',
  },
}
