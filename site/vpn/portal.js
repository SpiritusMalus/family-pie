(() => {
  const canvas = document.querySelector('#portal');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 1, height = 1, frame = 0, visible = true;
  let targetX = 0, targetY = 0, tiltX = 0, tiltY = 0;
  const particles = Array.from({ length: 100 }, (_, i) => ({
    angle: i * 2.399963, radius: .2 + ((i * 43) % 97) / 120,
    speed: .15 + (i % 7) / 40, size: i % 17 === 0 ? 1.4 : .55
  }));
  function draw(time = 0) {
    frame = 0;
    const t = reduced.matches ? 0 : time * .00013;
    tiltX += (targetX - tiltX) * .06;
    tiltY += (targetY - tiltY) * .06;
    const cx = width * .51 + tiltX * 15, cy = height * .49 + tiltY * 12;
    const r = Math.min(width, height) * .345;
    ctx.clearRect(0, 0, width, height);
    const glow = ctx.createRadialGradient(cx, cy, r * .48, cx, cy, r * 1.3);
    glow.addColorStop(0, 'rgba(245,35,60,0)');
    glow.addColorStop(.36, 'rgba(218,21,49,.11)');
    glow.addColorStop(.7, 'rgba(158,22,35,.055)');
    glow.addColorStop(1, 'rgba(158,22,35,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
    for (let n = 7; n >= 0; n--) {
      const depth = Math.pow(.86, n);
      const rx = r * depth, ry = r * depth * .82;
      const x = cx + n * 4.5 + tiltX * n * 1.2;
      const y = cy - n * 4 + tiltY * n;
      const rotation = -.28 + tiltX * .06;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rotation);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(221,54,72,${.1 + (7 - n) * .015})`;
      ctx.lineWidth = .7; ctx.stroke();
      const start = -.5 + n * .43 + t * (n % 2 ? .2 : -.15);
      const gradient = ctx.createLinearGradient(-rx, -ry, rx, ry);
      gradient.addColorStop(0, `rgba(255,42,67,${.22 + depth * .3})`);
      gradient.addColorStop(.55, `rgba(255,80,86,${.45 + depth * .45})`);
      gradient.addColorStop(1, `rgba(255,219,205,${.3 + depth * .65})`);
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, start, start + 2.7);
      ctx.strokeStyle = gradient; ctx.lineWidth = n === 0 ? 2.3 : 1.1;
      ctx.shadowBlur = n === 0 ? 18 : 9; ctx.shadowColor = '#ff2847'; ctx.stroke();
      ctx.restore();
    }
    for (const p of particles) {
      const a = p.angle + t * p.speed;
      const x = cx + Math.cos(a) * r * p.radius * 1.35;
      const y = cy + Math.sin(a) * r * p.radius * 1.18;
      ctx.beginPath(); ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.size > 1 ? 'rgba(255,182,164,.65)' : 'rgba(255,91,103,.25)';
      ctx.fill();
    }
    if (!reduced.matches && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }
  function restart() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; draw(performance.now());
  }
  const resize = new ResizeObserver(() => {
    const box = canvas.getBoundingClientRect(); width = box.width; height = box.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); restart();
  });
  resize.observe(canvas);
  canvas.addEventListener('pointermove', e => {
    if (reduced.matches) return;
    const box = canvas.getBoundingClientRect();
    targetX = (e.clientX - box.left) / box.width * 2 - 1;
    targetY = (e.clientY - box.top) / box.height * 2 - 1;
  });
  canvas.addEventListener('pointerleave', () => { targetX = targetY = 0; });
  const visibility = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; restart(); });
  visibility.observe(canvas);
  document.addEventListener('visibilitychange', restart);
  reduced.addEventListener('change', restart);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect();
  }, { once: true });
})();
