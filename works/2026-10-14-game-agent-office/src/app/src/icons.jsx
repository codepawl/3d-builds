// 16px line icons drawn in currentColor. Each status has its own shape, not only its own colour.
function Icon({ children, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const BoltIcon = (props) => (
  <Icon {...props}>
    <path d="M9 1.5 3.5 9h4L7 14.5 12.5 7h-4z" fill="currentColor" stroke="none" />
  </Icon>
);
export const WalkIcon = (props) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6" />
    <path d="M6.5 5.5 9 8l-2.5 2.5" />
  </Icon>
);
export const HourglassIcon = (props) => (
  <Icon {...props}>
    <path d="M4 2h8M4 14h8M5 2c0 3 6 3 6 6s-6 3-6 6M11 2c0 3-6 3-6 6s6 3 6 6" />
  </Icon>
);
export const ClipboardIcon = (props) => (
  <Icon {...props}>
    <rect x="3" y="2.5" width="10" height="12" rx="2" />
    <path d="M6 6.5h4M6 9h4M6 11.5h2.5" />
  </Icon>
);
export const MoonIcon = (props) => (
  <Icon {...props}>
    <path d="M12.5 10A5.5 5.5 0 0 1 6 3.5a5.5 5.5 0 1 0 6.5 6.5z" />
  </Icon>
);
export const CheckCircleIcon = (props) => (
  <Icon {...props}>
    <circle cx="8" cy="8" r="6.2" fill="currentColor" stroke="none" />
    <path d="m5.2 8.2 1.9 1.9 3.8-4" stroke="#fff" />
  </Icon>
);
export const OctagonIcon = (props) => (
  <Icon {...props}>
    <path d="M5.5 1.8h5l3.7 3.7v5l-3.7 3.7h-5l-3.7-3.7v-5z" fill="currentColor" stroke="none" />
    <path d="m6 6 4 4M10 6l-4 4" stroke="#fff" />
  </Icon>
);
export const ShieldIcon = (props) => (
  <Icon {...props}>
    <path d="M8 1.8 13 3.8v4c0 3-2.2 5.2-5 6.4-2.8-1.2-5-3.4-5-6.4v-4z" />
    <path d="m5.8 8 1.6 1.6 3-3" />
  </Icon>
);
export const InboxIcon = (props) => (
  <Icon {...props}>
    <path d="M2 9.5 4 3h8l2 6.5V13H2z" />
    <path d="M2 9.5h3.5l1 1.5h3l1-1.5H14" />
  </Icon>
);
export const SearchIcon = (props) => (
  <Icon {...props}>
    <circle cx="7" cy="7" r="4.5" />
    <path d="m10.5 10.5 3.5 3.5" />
  </Icon>
);
export const ChevronDownIcon = (props) => (
  <Icon {...props}>
    <path d="m4 6 4 4 4-4" />
  </Icon>
);
export const PlusIcon = (props) => (
  <Icon {...props}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const MinusIcon = (props) => (
  <Icon {...props}>
    <path d="M3 8h10" />
  </Icon>
);
export const HomeIcon = (props) => (
  <Icon {...props}>
    <path d="M2.5 7.5 8 2.5l5.5 5V13.5h-11z" />
    <path d="M6.5 13.5v-3.5h3v3.5" />
  </Icon>
);
export const RotateIcon = (props) => (
  <Icon {...props}>
    <path d="M13 8a5 5 0 1 1-1.5-3.6" />
    <path d="M13 2.5v3h-3" />
  </Icon>
);
export const RoomIcon = (props) => (
  <Icon {...props}>
    <path d="M2 13.5V5l6-3 6 3v8.5z" />
    <path d="M6 13.5v-4h4v4" />
  </Icon>
);

export function LogoMark({ size = 28 }) {
  // Original mark: a rounded tile with a little desk and a worker's lit eyes.
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true">
      <rect x="1" y="1" width="26" height="26" rx="8" fill="#6d4aff" />
      <rect x="6.5" y="6" width="15" height="10" rx="4" fill="#fff" />
      <circle cx="11.5" cy="11" r="1.6" fill="#6d4aff" />
      <circle cx="16.5" cy="11" r="1.6" fill="#6d4aff" />
      <rect x="5" y="19" width="18" height="3" rx="1.5" fill="#fff" opacity="0.75" />
    </svg>
  );
}
