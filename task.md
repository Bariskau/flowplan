Bug'lar:
ubuntuda scroll çok zoom yapıyor ilk kaydırmadan 10'dan 90'na gidiyor. Macte ise iyi.
dependency olmadan kayıt olmayı engellemeye çalışdım ama bir check et.
Mcp'ler doğru bilgi vermiyor gibi coding agenta çok daha gelişmiş ve net direktifler olmalı.
token usage yüksek gibi. (tüm bilgileri tekte vermek yerine bunu daha optimize yapmak gerekebilir.)

Yeni beklediğim özellikler:
manuel plan ekleme.(mcp yanına + butonu basınca menü acılsın import json ve new plan gibi, bir modal açılsın plan adı alsın)
manuel card ekle ve ok çekme özelliği ekle. (dependency required durumuyla conflict çıkabilir burada, manuel eklenen kartlara ve editlenenlere flag tutulabilir. uygun çözüm bul)
mevcut card'ların(içeriklerini , başlıklarını, tiplerini, file changes içinde textleri içini editleme özelliği) not: history card'larda olmayacak
okların sırısını manuel değiştirebilme. 

optimizasyon:
check updates ve about modalları çok kötü açılıyor gibi. onları optimize bir şekle çevir.

Görünüm özellikleri:
sol bar ve drawerlarda blur kullan arkaplan gözüksün ama blurlu glassy bir şekilde.
arkaplana güzel bir şey ekle canvasta ve card'larda glassy olsun. arkaplanda dot'lar olabilir mouse geçtiği yerlerde o noktalar efektli parlayabilir.  

Technical Debt:
varsa bunları da tamamla. 


Test süreci:
Mcp related update'lerinden sonra en az 10 farklı plan oluştur app üzerinde isterlerimi karşılıyor mu bak. karşılamıyorsa düzelt.



örnek bg:
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Interactive Dot Grid</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0e0e10;
      overflow: hidden;
      width: 100vw;
      height: 100vh;
    }
    canvas {
      display: block;
    }
    /* İçerik örneği */
    .content {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .card {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 16px;
      padding: 40px 60px;
      text-align: center;
      color: #fff;
      font-family: 'Segoe UI', sans-serif;
      backdrop-filter: blur(12px);
    }
    .card h1 { font-size: 2rem; font-weight: 700; margin-bottom: 8px; }
    .card p  { font-size: 1rem; color: rgba(255,255,255,0.5); }
  </style>
</head>
<body>

<canvas id="dotCanvas"></canvas>

<div class="content">
  <div class="card">
    <h1>Interactive Dot Grid</h1>
    <p>Mouse'u hareket ettir, noktalar yanıt versin.</p>
  </div>
</div>

<script>
  const canvas = document.getElementById('dotCanvas');
  const ctx    = canvas.getContext('2d');

  // --- Ayarlar ---
  const CONFIG = {
    spacing:       28,       // noktalar arası boşluk (px)
    dotRadius:     1.5,      // temel nokta yarıçapı
    dotColor:      [50, 50, 60],    // varsayılan renk (r,g,b)
    glowColor:     [140, 80, 255],  // mouse yakınındaki renk (mor)
    accentColor:   [80, 180, 255],  // ikincil vurgu rengi (mavi)
    influenceRadius: 140,    // mouse'un etki yarıçapı (px)
    maxGlowRadius: 3.5,      // parlayan noktanın max yarıçapı
    trailDecay:    0.05,     // iz sönme hızı (0–1)
  };

  let mouse = { x: -9999, y: -9999 };
  let dots  = [];

  // Tuval boyutunu pencereye uydur
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildDots();
  }

  // Nokta grid'ini oluştur
  function buildDots() {
    dots = [];
    const cols = Math.ceil(canvas.width  / CONFIG.spacing) + 1;
    const rows = Math.ceil(canvas.height / CONFIG.spacing) + 1;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        dots.push({
          x:         c * CONFIG.spacing,
          y:         r * CONFIG.spacing,
          intensity: 0,   // 0 = sönük, 1 = tam parlak
        });
      }
    }
  }

  // Renk interpolasyonu (iki renk arasında)
  function lerpColor(a, b, t) {
    return [
      Math.round(a[0] + (b[0] - a[0]) * t),
      Math.round(a[1] + (b[1] - a[1]) * t),
      Math.round(a[2] + (b[2] - a[2]) * t),
    ];
  }

  // Her frame çizimi
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const dot of dots) {
      const dx   = dot.x - mouse.x;
      const dy   = dot.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Mouse yakınlığına göre hedef yoğunluk
      const targetIntensity = dist < CONFIG.influenceRadius
        ? Math.pow(1 - dist / CONFIG.influenceRadius, 2)
        : 0;

      // Yoğunluğu yumuşakça güncelle (lerp)
      dot.intensity += (targetIntensity - dot.intensity) * 0.12;

      // Belirli eşiğin altındaysa atlat (performans)
      if (dot.intensity < 0.008) {
        // Varsayılan küçük noktayı çiz
        ctx.beginPath();
        ctx.arc(dot.x, dot.y, CONFIG.dotRadius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CONFIG.dotColor.join(',')}, 0.4)`;
        ctx.fill();
        continue;
      }

      const t = dot.intensity;

      // İki renkli geçiş: 0→0.5 mavi, 0.5→1 mor
      const color = t > 0.5
        ? lerpColor(CONFIG.accentColor, CONFIG.glowColor, (t - 0.5) * 2)
        : lerpColor(CONFIG.dotColor,    CONFIG.accentColor, t * 2);

      const radius = CONFIG.dotRadius + (CONFIG.maxGlowRadius - CONFIG.dotRadius) * t;

      // Glow efekti (shadow blur)
      ctx.shadowBlur  = 8 * t;
      ctx.shadowColor = `rgba(${CONFIG.glowColor.join(',')}, ${t})`;

      ctx.beginPath();
      ctx.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color.join(',')}, ${0.4 + 0.6 * t})`;
      ctx.fill();

      ctx.shadowBlur  = 0;
      ctx.shadowColor = 'transparent';
    }

    requestAnimationFrame(draw);
  }

  // Eventler
  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });

  window.addEventListener('resize', resize);

  // Başlat
  resize();
  draw();
</script>
</body>
</html>

Flowu sen oluşturma:
React flow kullan cardları içinde tasarla.

örnek glassy card:


Son beklentiler:
toplu kart eklemeyi kaldıralım coding agent tek tek eklesin.



https://protocol.tailwindui.com/
bu siteye git tasarımları bu siteden örnek alarak yapmalısın.  playwright ile açabilirsin.
plan sayfası yandaki menü gibi olsun animasyonlu geçişi vs iyi. chipler ekrandakiler gibi olsun. kod gösterme vs kısmıda var gibi.
suanki hali glassy ui değil her yer glassy olmalı. 



drawer'lar card'lar hepsi glasy olmalı arkasındaki kısım blurlu gözükmeli. mordern ama abartılı değil.
bg'deki dot kısmı biraz sorunlu zoom yapınca çok ayrık duruyor kötü oluyor. 
referans sitedkine benzer bir gradient bg harika olur. 
add card butonuda sol üstte ve glassy olmalı

bak cardlardaki paddingler, border radiuslar, icon büyüküleri renk vs herşey gitti. bunları ayarlamalısın. p-3, px-2 vb tailwind sınıflarıyla. 
active plan tabında yeşil olmasın glassy olsun.
gradient sorunu devam ediyor.
3 noktaya basınca menü acılıyorya onuda component yap gene glassy olsun. elemanları icon ve renk olabilir gibi genel bir şey yap.
header sağa kaydı küçüldü, sidepanelden başlamalıydı.
canvas içinde ki zoom add card butonları vs sidepanel yanından başlamalı.
tüm componentleri tek tek gez tüm stillerini ayarla.
drawer genişliğini biraz azalt çok geniş. 
cardların konumları bıraktığım yerde kalmıyor. 
history drawer çok dar.
cardlara sağ tıklayınca menü açılsın, 3 noktaya basınca gelen gibi. edit, delete seçeneği olsun.
iconlar için svg değil https://github.com/phosphor-icons/react bunu kullan.
info card directive, question tasarımları düzelt. https://protocol.tailwindui.com/ bu sayfada altta 4 card var contacts vs. onlar gibi yapabilirsin directive sarı mouse hover olur, question blue olur mouse ile gezince. glassy olurlar gene.
card içleri mardown onlarda render olmalı.
dot bg'yi verdiğim gibi yap. [example-dot-bg.html](example-dot-bg.html)
