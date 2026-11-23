import * as THREE from "../v11/vendor/three.module.min.js";

export function paintedTexture(width, height, paint) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext("2d"), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function grain(ctx, width, height, random, count, opacity) {
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = i % 2 ? `rgba(48,29,26,${opacity})` : `rgba(255,241,213,${opacity})`;
    ctx.fillRect(random() * width, random() * height, 1 + random() * 4, 1 + random() * 3);
  }
}

export function streetTextures(random) {
  const plaster = paintedTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = "#d7cec5";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 290; i += 1) {
      const x = random() * w;
      const y = random() * h;
      const radius = 3 + random() * 35;
      const wash = ctx.createRadialGradient(x, y, 0, x, y, radius);
      wash.addColorStop(0, i % 2 ? "#654a3940" : "#fff9eb73");
      wash.addColorStop(1, "#86726400");
      ctx.fillStyle = wash;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let i = 0; i < 210; i += 1) {
      ctx.fillStyle = i % 2 ? "#54453a14" : "#f7e8d133";
      ctx.fillRect(random() * w, random() * h, 0.5 + random() * 1.5, 3 + random() * 29);
    }
    grain(ctx, w, h, random, 4600, 0.18);
  });

  const wood = paintedTexture(128, 256, (ctx, w, h) => {
    ctx.fillStyle = "#c9baad";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 215; i += 1) {
      const x = random() * w;
      const y = random() * h;
      ctx.strokeStyle = i % 2 ? "#65442d4f" : "#fff4db6e";
      ctx.lineWidth = 0.4 + random() * 1.6;
      ctx.beginPath();
      ctx.moveTo(x, y - 38);
      ctx.bezierCurveTo(x - 3, y - 6, x + 5, y + 10, x + 1, y + 48);
      ctx.stroke();
    }
  });

  const roof = paintedTexture(128, 128, (ctx, w, h) => {
    const lap = ctx.createLinearGradient(0, 0, 0, h);
    lap.addColorStop(0, "#b69387");
    lap.addColorStop(0.12, "#775d58");
    lap.addColorStop(0.34, "#d1b1a1");
    lap.addColorStop(0.89, "#e7c2a9");
    lap.addColorStop(1, "#a2786d");
    ctx.fillStyle = lap;
    ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, random, 2100, 0.20);
  });

  const cloth = paintedTexture(64, 256, (ctx, w, h) => {
    ctx.fillStyle = "#ece2d1";
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < w; i += 2) {
      ctx.fillStyle = i % 4 ? "#695b4730" : "#fff3da55";
      ctx.fillRect(i, 0, 1, h);
    }
    for (let i = 1; i < h; i += 3) {
      ctx.fillStyle = "#5c544326";
      ctx.fillRect(0, i, w, 1);
    }
    const seam = ctx.createLinearGradient(0, 0, w, 0);
    seam.addColorStop(0, "#453b3180");
    seam.addColorStop(0.14, "#fff6ed00");
    seam.addColorStop(0.84, "#fff6ed00");
    seam.addColorStop(1, "#342c245f");
    ctx.fillStyle = seam;
    ctx.fillRect(0, 0, w, h);
  });

  const encaustic = paintedTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = "#efe1bf";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "#486b57";
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 120, 120);
    for (let i = 0; i < 4; i += 1) {
      ctx.save();
      ctx.translate(64, 64);
      ctx.rotate(i * Math.PI / 2);
      ctx.fillStyle = "#426957";
      ctx.beginPath();
      ctx.moveTo(-5, -7);
      ctx.quadraticCurveTo(-40, -33, -40, -52);
      ctx.quadraticCurveTo(-15, -54, -9, -20);
      ctx.quadraticCurveTo(-16, -53, 1, -56);
      ctx.quadraticCurveTo(20, -48, 5, -17);
      ctx.quadraticCurveTo(28, -50, 46, -49);
      ctx.quadraticCurveTo(37, -23, 5, -7);
      ctx.fill();
      ctx.fillStyle = "#ae604d";
      ctx.beginPath();
      ctx.ellipse(0, -23, 5, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(42, -58, 14, 14);
      ctx.restore();
    }
    ctx.fillStyle = "#c48c51";
    ctx.beginPath();
    ctx.arc(64, 64, 9, 0, Math.PI * 2);
    ctx.fill();
    grain(ctx, w, h, random, 600, 0.14);
  });

  const lightPool = paintedTexture(128, 128, (ctx, w, h) => {
    const light = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    light.addColorStop(0, "#ffb96dc6");
    light.addColorStop(0.33, "#ffa8576b");
    light.addColorStop(0.7, "#f9893b22");
    light.addColorStop(1, "#ed7c3100");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, w, h);
  });

  const occlusion = paintedTexture(64, 64, (ctx, w, h) => {
    const shadow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    shadow.addColorStop(0, "#241714bb");
    shadow.addColorStop(0.48, "#24171483");
    shadow.addColorStop(1, "#1d151300");
    ctx.fillStyle = shadow;
    ctx.fillRect(0, 0, w, h);
  });
  return { plaster, wood, roof, cloth, encaustic, lightPool, occlusion };
}

export function pavingTexture(road, random) {
  const texture = paintedTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = road ? "#2f323b" : "#765953";
    ctx.fillRect(0, 0, w, h);
    const columns = road ? 8 : 4;
    const rows = road ? 10 : 6;
    const tileWidth = w / columns;
    const tileHeight = h / rows;
    const hues = road ? ["#584f4a", "#4a4647", "#544c53", "#62615d", "#464650"] :
      ["#c99072", "#9b7060", "#ba8d78", "#b2806a", "#cd9d84"];
    for (let row = 0; row < rows; row += 1) {
      for (let col = -1; col < columns; col += 1) {
        const x = (col + (row % 2) * 0.5) * tileWidth;
        const y = row * tileHeight;
        ctx.fillStyle = hues[Math.floor(random() * hues.length)];
        ctx.fillRect(x + 1.2, y + 1.2, tileWidth - 2.4, tileHeight - 2.4);
        ctx.strokeStyle = road ? "#b6a19a4d" : "#e8b7998f";
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 3);
        ctx.lineTo(x + tileWidth - 6, y + 3);
        ctx.stroke();
        ctx.fillStyle = "#1b182637";
        ctx.fillRect(x + 3, y + tileHeight - 4, tileWidth - 6, 2);
      }
    }
    grain(ctx, w, h, random, 15000, 0.17);
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(road ? 10 : 27, road ? 7 : 2);
  return texture;
}
