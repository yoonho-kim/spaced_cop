import {
  Beef,
  Building2,
  Coffee,
  CookingPot,
  CupSoda,
  Drumstick,
  EggFried,
  Heart,
  Milk,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  UtensilsCrossed,
  Wheat,
} from 'lucide-react';

const createSpec = (Icon, color, background, strokeWidth = 2.2) => ({
  Icon,
  color,
  background,
  strokeWidth,
});

const ICON_SPECS = Object.freeze({
  praise: createSpec(Heart, '#e11d48', 'rgba(244, 63, 94, 0.14)'),
  lunch: createSpec(UtensilsCrossed, '#ea580c', 'rgba(251, 146, 60, 0.16)'),
  coffee: createSpec(Coffee, '#92400e', 'rgba(217, 119, 6, 0.14)'),
  kimbap: createSpec(UtensilsCrossed, '#0f766e', 'rgba(20, 184, 166, 0.14)'),
  gukbap: createSpec(Soup, '#c2410c', 'rgba(249, 115, 22, 0.14)'),
  bibimbap: createSpec(Salad, '#15803d', 'rgba(34, 197, 94, 0.14)'),
  naengmyeon: createSpec(Soup, '#2563eb', 'rgba(59, 130, 246, 0.14)'),
  pasta: createSpec(Wheat, '#b45309', 'rgba(245, 158, 11, 0.16)'),
  sandwich: createSpec(Sandwich, '#854d0e', 'rgba(234, 179, 8, 0.18)'),
  americano: createSpec(Coffee, '#7c2d12', 'rgba(217, 119, 6, 0.16)'),
  latte: createSpec(Milk, '#0891b2', 'rgba(103, 232, 249, 0.2)'),
  cappuccino: createSpec(Coffee, '#92400e', 'rgba(245, 158, 11, 0.14)'),
  milktea: createSpec(CupSoda, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  bubbletea: createSpec(CupSoda, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  cafeteria: createSpec(Building2, '#2563eb', 'rgba(96, 165, 250, 0.18)'),
  chicken: createSpec(Drumstick, '#dc2626', 'rgba(248, 113, 113, 0.18)'),
  pizza: createSpec(Pizza, '#f97316', 'rgba(253, 186, 116, 0.2)'),
  beef: createSpec(Beef, '#b91c1c', 'rgba(252, 165, 165, 0.18)'),
  egg: createSpec(EggFried, '#ca8a04', 'rgba(253, 224, 71, 0.18)'),
  defaultMeal: createSpec(CookingPot, '#475569', 'rgba(148, 163, 184, 0.16)'),
});

const normalizeText = (value = '') => String(value).toLowerCase().replace(/\s+/g, '');

const hasKeyword = (text, keywords) => keywords.some((keyword) => text.includes(keyword));

export const getDefaultIconSpec = () => ICON_SPECS.defaultMeal;

export const getQuickVoteIconSpec = (voteType, optionKey = '') => {
  if (optionKey && ICON_SPECS[optionKey]) {
    return ICON_SPECS[optionKey];
  }

  if (voteType && ICON_SPECS[voteType]) {
    return ICON_SPECS[voteType];
  }

  return ICON_SPECS.defaultMeal;
};

export const getLunchMenuIconSpec = (menu = {}) => {
  if (menu?.isCafeteria) {
    return ICON_SPECS.cafeteria;
  }

  const text = normalizeText(`${menu?.id ?? ''} ${menu?.name ?? ''} ${menu?.emoji ?? ''}`);

  if (hasKeyword(text, ['americano', '아메리카노', 'coffee', '커피', '카푸치노', 'cappuccino'])) {
    return ICON_SPECS.americano;
  }
  if (hasKeyword(text, ['latte', '라떼', '우유', 'milk'])) {
    return ICON_SPECS.latte;
  }
  if (hasKeyword(text, ['밀크티', 'milktea', '버블티', 'bubbletea', 'tea', '티'])) {
    return ICON_SPECS.milktea;
  }
  if (hasKeyword(text, ['샌드위치', 'sandwich', 'toast', '토스트', 'burger', '버거'])) {
    return ICON_SPECS.sandwich;
  }
  if (hasKeyword(text, ['파스타', 'pasta', 'spaghetti', '스파게티'])) {
    return ICON_SPECS.pasta;
  }
  if (hasKeyword(text, ['냉면', 'naengmyeon', '우동', 'udon', '국수', 'noodle', '면'])) {
    return ICON_SPECS.naengmyeon;
  }
  if (hasKeyword(text, ['비빔밥', 'bibimbap', '덮밥', '볶음밥', 'friedrice', '샐러드', 'salad', '포케', 'poke'])) {
    return ICON_SPECS.bibimbap;
  }
  if (hasKeyword(text, ['국밥', 'gukbap', '찌개', '탕', 'soup'])) {
    return ICON_SPECS.gukbap;
  }
  if (hasKeyword(text, ['김밥', 'kimbap', '라면', 'ramen', 'ramyun', '분식'])) {
    return ICON_SPECS.kimbap;
  }
  if (hasKeyword(text, ['치킨', 'chicken', '닭'])) {
    return ICON_SPECS.chicken;
  }
  if (hasKeyword(text, ['피자', 'pizza'])) {
    return ICON_SPECS.pizza;
  }
  if (hasKeyword(text, ['불고기', '스테이크', '소고기', 'beef', '고기'])) {
    return ICON_SPECS.beef;
  }
  if (hasKeyword(text, ['계란', 'egg'])) {
    return ICON_SPECS.egg;
  }
  if (hasKeyword(text, ['구내식당', 'cafeteria', '사내식당', '식당'])) {
    return ICON_SPECS.cafeteria;
  }

  return ICON_SPECS.defaultMeal;
};
