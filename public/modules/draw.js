const DESTROY_EFFECT = {
  COUNT: 3,
  SPEED: 1.5,
  LIFETIME: 200,
  SIZE: 1,
};

const createExplosion = (x, y, skinData) => {
  const particles = [];

  for (let i = 0; i < DESTROY_EFFECT.COUNT; i++) {
    const angle = Math.random() * Math.PI * 2;

    particles.push({
      x: x,
      y: y,
      vx: Math.cos(angle) * DESTROY_EFFECT.SPEED,
      vy: Math.sin(angle) * DESTROY_EFFECT.SPEED,
      createdAt: Date.now(),
      lifeTime: DESTROY_EFFECT.LIFETIME,
      skin: skinData,
    });
  }

  return particles;
};

const renderExplosions = (ctx, canvasW, canvasH, targetArray) => {
  const now = Date.now();

  for (let i = targetArray.length - 1; i >= 0; i--) {
    const p = targetArray[i];
    const elapsed = now - p.createdAt;

    if (elapsed >= p.lifeTime) {
      targetArray.splice(i, 1);
      continue;
    }

    p.x += p.vx;
    p.y += p.vy;

    const cx = (canvasW / 200) * (p.x + 100);
    const cy = (canvasH / 200) * (p.y + 100);
    const progress = elapsed / p.lifeTime;
    const size = (canvasW / 100) * DESTROY_EFFECT.SIZE * (1 - progress);

    if (size <= 0) continue;

    ctx.save();

    ctx.beginPath();
    const skin = p.skin;

    if (skin.type === "gradient") {
      const grd = ctx.createLinearGradient(cx - size, cy - size, cx + size, cy + size);
      for (let s = 0; s < skin.stops.length; s++) {
        grd.addColorStop(skin.stops[s].percentage / 100, `#${skin.stops[s].color}`);
      }
      ctx.fillStyle = grd;
    } else {
      ctx.fillStyle = `#${skin.color}`;
    }

    ctx.arc(cx, cy, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
};
