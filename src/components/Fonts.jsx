import { T } from '../styles/tokens';

export default function Fonts() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700&family=Inter:wght@400;500&family=JetBrains+Mono:wght@400;500;600&display=swap');
      @import url('https://unpkg.com/leaflet@1.9.4/dist/leaflet.css');
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
      html{-webkit-font-smoothing:antialiased;}
      body{background:${T.bg};}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
      @keyframes fadeUp{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:translateY(0)}}
      .fade{animation:fadeUp 0.3s ease forwards;}
      .rh:hover{background:${T.bgDark}!important;}
      .sg:hover{background:${T.bgDark}!important;}
      .bp:hover{opacity:0.84;}
      .bg:hover{background:${T.bgDark}!important;}
      .nb:hover{color:${T.ink}!important;}
      .leaflet-container{font-family:Inter,sans-serif;}
      .leaflet-control-attribution{font-size:9px!important;}
    `}</style>
  );
}
