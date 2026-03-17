import {
  Apple,
  Bird,
  Brain,
  Building2,
  CalendarDays,
  Candy,
  Check,
  Citrus,
  Coffee,
  DoorOpen,
  FileText,
  Fish,
  Ghost,
  Handshake,
  Leaf,
  Mars,
  Medal,
  MoonStar,
  Newspaper,
  Package,
  PawPrint,
  Plane,
  Popcorn,
  RadioTower,
  Rocket,
  Smile,
  Snowflake,
  Sparkles,
  Sun,
  Sunset,
  Trees,
  UserRound,
  Venus,
  Waves,
  X,
} from 'lucide-react';

const createSpec = (Icon, color, background = 'transparent', strokeWidth = 2.2) => ({
  Icon,
  color,
  background,
  strokeWidth,
});

const UI_ICON_SPECS = Object.freeze({
  close: createSpec(X, '#475569'),
  check: createSpec(Check, '#16a34a'),
  meetingRoom: createSpec(DoorOpen, '#2563eb', 'rgba(96, 165, 250, 0.18)'),
  meetingCalendar: createSpec(CalendarDays, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  feedEmpty: createSpec(FileText, '#475569', 'rgba(148, 163, 184, 0.16)'),
  newsError: createSpec(RadioTower, '#dc2626', 'rgba(248, 113, 113, 0.18)'),
  newsEmpty: createSpec(Newspaper, '#2563eb', 'rgba(96, 165, 250, 0.18)'),
  suppliesEmpty: createSpec(Package, '#0f766e', 'rgba(45, 212, 191, 0.18)'),
  volunteerEmpty: createSpec(Handshake, '#0f766e', 'rgba(52, 211, 153, 0.18)'),
  popcorn: createSpec(Popcorn, '#d97706', 'rgba(251, 191, 36, 0.18)'),
  morning: createSpec(Sun, '#f59e0b', 'rgba(251, 191, 36, 0.18)'),
  afternoon: createSpec(Leaf, '#15803d', 'rgba(74, 222, 128, 0.16)'),
  evening: createSpec(Sunset, '#ea580c', 'rgba(251, 146, 60, 0.16)'),
  night: createSpec(MoonStar, '#4338ca', 'rgba(129, 140, 248, 0.18)'),
  citrus: createSpec(Citrus, '#ca8a04', 'rgba(250, 204, 21, 0.18)'),
  chocolate: createSpec(Candy, '#92400e', 'rgba(217, 119, 6, 0.16)'),
  mint: createSpec(Snowflake, '#0891b2', 'rgba(103, 232, 249, 0.18)'),
  city: createSpec(Building2, '#2563eb', 'rgba(96, 165, 250, 0.18)'),
  forest: createSpec(Trees, '#15803d', 'rgba(74, 222, 128, 0.16)'),
  beach: createSpec(Waves, '#0284c7', 'rgba(125, 211, 252, 0.18)'),
  space: createSpec(Rocket, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  cat: createSpec(PawPrint, '#f97316', 'rgba(253, 186, 116, 0.2)'),
  dog: createSpec(PawPrint, '#ea580c', 'rgba(251, 146, 60, 0.16)'),
  owl: createSpec(Bird, '#7c3aed', 'rgba(196, 181, 253, 0.18)'),
  dolphin: createSpec(Fish, '#0284c7', 'rgba(125, 211, 252, 0.18)'),
  teleport: createSpec(Sparkles, '#f59e0b', 'rgba(253, 224, 71, 0.18)'),
  invisible: createSpec(Ghost, '#64748b', 'rgba(148, 163, 184, 0.18)'),
  mindread: createSpec(Brain, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  fly: createSpec(Plane, '#0284c7', 'rgba(125, 211, 252, 0.18)'),
  coffee: createSpec(Coffee, '#7c2d12', 'rgba(217, 119, 6, 0.16)'),
  chips: createSpec(Popcorn, '#f59e0b', 'rgba(253, 224, 71, 0.18)'),
  fruit: createSpec(Apple, '#dc2626', 'rgba(248, 113, 113, 0.16)'),
  male: createSpec(Mars, '#2563eb', 'rgba(96, 165, 250, 0.18)'),
  female: createSpec(Venus, '#db2777', 'rgba(244, 114, 182, 0.18)'),
  other: createSpec(Smile, '#475569', 'rgba(148, 163, 184, 0.16)'),
  rankGold: createSpec(Medal, '#ca8a04', 'rgba(250, 204, 21, 0.18)'),
  rankSilver: createSpec(Medal, '#64748b', 'rgba(203, 213, 225, 0.3)'),
  rankBronze: createSpec(Medal, '#b45309', 'rgba(253, 186, 116, 0.2)'),
  winnerA: createSpec(UserRound, '#0284c7', 'rgba(125, 211, 252, 0.18)'),
  winnerB: createSpec(UserRound, '#7c3aed', 'rgba(196, 181, 253, 0.2)'),
  winnerC: createSpec(UserRound, '#ea580c', 'rgba(251, 146, 60, 0.16)'),
  winnerD: createSpec(UserRound, '#15803d', 'rgba(74, 222, 128, 0.16)'),
  winnerE: createSpec(UserRound, '#dc2626', 'rgba(248, 113, 113, 0.16)'),
  winnerF: createSpec(UserRound, '#0f766e', 'rgba(45, 212, 191, 0.16)'),
  winnerG: createSpec(UserRound, '#1d4ed8', 'rgba(96, 165, 250, 0.18)'),
  winnerH: createSpec(UserRound, '#c2410c', 'rgba(251, 146, 60, 0.18)'),
});

const WINNER_ICON_KEYS = ['winnerA', 'winnerB', 'winnerC', 'winnerD', 'winnerE', 'winnerF', 'winnerG', 'winnerH'];

export const getUiIconSpec = (key) => UI_ICON_SPECS[key] || UI_ICON_SPECS.feedEmpty;

export const getRankIconSpec = (index) => {
  if (index === 0) return UI_ICON_SPECS.rankGold;
  if (index === 1) return UI_ICON_SPECS.rankSilver;
  if (index === 2) return UI_ICON_SPECS.rankBronze;
  return null;
};

export const getWinnerAvatarSpec = (index) => UI_ICON_SPECS[WINNER_ICON_KEYS[index % WINNER_ICON_KEYS.length]];

export const SIGN_UP_GENDER_OPTIONS = Object.freeze([
  { value: 'male', label: '남성', iconKey: 'male' },
  { value: 'female', label: '여성', iconKey: 'female' },
  { value: 'other', label: '기타', iconKey: 'other' },
]);
