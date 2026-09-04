import { THEME_STORAGE_KEY } from "./theme";

const SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export function ThemeScript() {
  // biome-ignore lint/security/noDangerouslySetInnerHtml: o tema tem que ser aplicado antes da primeira pintura, e o conteudo e uma constante deste modulo.
  return <script dangerouslySetInnerHTML={{ __html: SCRIPT }} />;
}
