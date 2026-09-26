import { WEB_APP_MANIFEST } from "./manifest";

export const PWA_INSTALL_COPY = {
  title: "홈 화면에 추가",
  body_mob: "세컨드 브레인을 앱처럼 바로 열어요. 온라인에서 캡처·정리·검색.",
  body_desk: "브라우저에 설치해 세컨드 브레인을 독립 창으로 씁니다. 온라인 전제.",
  benefit_1: "홈 화면 아이콘으로 한 번에 진입",
  benefit_2: "브라우저 탭 없이 전체 화면",
  benefit_3: "설정에서도 언제든 다시 추가 가능",
  cta: "홈 화면에 추가",
  dismiss: "나중에",
  banner_title: "설치하면 홈·독에서 바로 열 수 있어요",
  banner_sub: "탭 없이 Vault Night 전체 화면 · 언제든 해제 가능",
  hide_banner: "배너 숨기기",
  ios_hint: "공유 버튼 → 「홈 화면에 추가」",
  status_eligible: "이 브라우저는 설치 가능 · 아직 추가되지 않음",
  status_installed: "이 기기에 설치됨",
  banner_add: "추가",
  settings_nav: "앱 · PWA",
} as const;

const icon192 = WEB_APP_MANIFEST.icons?.find((icon) => icon.sizes === "192x192")?.src;

export const PWA_ICON_192_SRC = icon192 ?? "/icons/icon-192.png";
