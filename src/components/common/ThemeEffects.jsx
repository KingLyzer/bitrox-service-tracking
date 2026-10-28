import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import christmasTreeImg from '../../assets/christmas_tree.jpg';
import ramadanMosqueImg from '../../assets/ramadan_mosque.jpg';
import auroraNightImg from '../../assets/aurora_night.jpg';
import eskisehirPorsukImg from '../../assets/eskisehir_porsuk.jpg';
import egyptPyramidsImg from '../../assets/egypt_pyramids.jpg';
import cozyCoffeeImg from '../../assets/cozy_coffee.jpg';
import retroArcadeImg from '../../assets/retro_arcade.jpg';
import summerBeachImg from '../../assets/summer_beach.jpg';
import militaryTacticalImg from '../../assets/military_tactical.jpg';

export default function ThemeEffects() {
  const { theme, effectsEnabled = true } = useApp();
  const snowCanvasRef = useRef(null);
  const sakuraCanvasRef = useRef(null);
  const autumnCanvasRef = useRef(null);
  const ramadanCanvasRef = useRef(null);
  const auroraCanvasRef = useRef(null);
  const rainCanvasRef = useRef(null);
  const desertCanvasRef = useRef(null);
  const coffeeCanvasRef = useRef(null);
  const arcadeCanvasRef = useRef(null);
  const summerCanvasRef = useRef(null);

  // 1. Snowfall & Holiday Magic effect for Christmas theme (High-Performance 60FPS Zero-Lag)
  useEffect(() => {
    if (theme !== 'christmas' || !effectsEnabled) return;
    const canvas = snowCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Multilayered snowfall: soft flakes, crystalline snow stars, and wind sway
    const snowParticles = Array.from({ length: 48 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.2 + 1.2,
      speedY: Math.random() * 1.3 + 0.65,
      speedX: (Math.random() - 0.45) * 0.7,
      opacity: Math.random() * 0.5 + 0.35,
      sway: Math.random() * 0.025 + 0.012,
      swayCount: Math.random() * 100,
      isCrystal: Math.random() < 0.2, // 20% crystallised 6-pointed ice snowflakes
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.02,
    }));

    // Warm Holiday Fireplace / Tree Magic Sparkles
    const sparkles = Array.from({ length: 12 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2.2 + 1.2,
      speedY: Math.random() * 0.6 + 0.25,
      speedX: (Math.random() - 0.5) * 0.3,
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: Math.random() * 0.04 + 0.02,
      color: Math.random() > 0.4 ? 'rgba(251, 191, 36, ' : (Math.random() > 0.5 ? 'rgba(254, 240, 138, ' : 'rgba(255, 255, 255, '),
    }));

    let lastTime = performance.now();

    const render = (now) => {
      const delta = Math.min((now - lastTime) / 16.67, 2);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      // Render Snowflakes
      snowParticles.forEach(p => {
        p.swayCount += p.sway * delta;
        p.y += p.speedY * delta;
        p.x += (Math.sin(p.swayCount) * 0.9 + p.speedX) * delta;
        p.rotation += p.rotationSpeed * delta;

        if (p.y > height + 15) {
          p.y = -15;
          p.x = Math.random() * width;
        }
        if (p.x > width + 15) p.x = -15;
        if (p.x < -15) p.x = width + 15;

        if (p.isCrystal) {
          // Delicate 6-Pointed Ice Crystal Snowflake
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rotation);
          ctx.strokeStyle = `rgba(255, 255, 255, ${p.opacity * 0.85})`;
          ctx.lineWidth = 1;
          const r = p.radius * 2.2;
          ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.moveTo(-r, 0);
            ctx.lineTo(r, 0);
            // Crystal side tines
            ctx.moveTo(-r * 0.6, -r * 0.3);
            ctx.lineTo(-r * 0.4, 0);
            ctx.lineTo(-r * 0.6, r * 0.3);
            ctx.moveTo(r * 0.6, -r * 0.3);
            ctx.lineTo(r * 0.4, 0);
            ctx.lineTo(r * 0.6, r * 0.3);
          }
          ctx.stroke();
          ctx.restore();
        } else {
          // Soft Fluffy Snowflake
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${p.opacity})`;
          ctx.fill();
        }
      });

      // Render Golden Holiday Sparkles
      sparkles.forEach(s => {
        s.pulse += s.pulseSpeed * delta;
        s.y += s.speedY * delta;
        s.x += s.speedX * delta;

        if (s.y > height + 10) {
          s.y = -10;
          s.x = Math.random() * width;
        }
        if (s.x > width + 10) s.x = -10;
        if (s.x < -10) s.x = width + 10;

        const currentOpacity = (Math.sin(s.pulse) + 1) * 0.4 + 0.15;
        if (currentOpacity > 0.18) {
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fillStyle = `${s.color}${currentOpacity})`;
          ctx.fill();
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, effectsEnabled]);

  // 2. Sakura falling petals effect for Sakura theme
  useEffect(() => {
    if (theme !== 'sakura' || !effectsEnabled) return;
    const canvas = sakuraCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const petals = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 8 + 6,
      speedY: Math.random() * 0.9 + 0.6,
      speedX: Math.random() * 0.8 + 0.2,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      swayCount: Math.random() * 100,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      petals.forEach(p => {
        p.swayCount += 0.02;
        p.y += p.speedY;
        p.x += Math.sin(p.swayCount) * 1.2 + p.speedX;
        p.rotation += p.rotationSpeed;

        if (p.y > height + 20) {
          p.y = -15;
          p.x = Math.random() * width;
        }
        if (p.x > width + 20) p.x = -10;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.scale(Math.cos(p.swayCount * 0.8), 1);

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(p.size * 0.6, -p.size * 0.4, p.size, -p.size * 0.2, p.size * 0.8, p.size * 0.5);
        ctx.bezierCurveTo(p.size * 0.6, p.size * 0.8, -p.size * 0.2, p.size * 0.6, 0, 0);
        ctx.fillStyle = `rgba(255, 182, 193, ${p.opacity})`;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(244, 114, 182, 0.4)';
        ctx.fill();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, effectsEnabled]);

  // 3. Autumn Falling Leaves effect (Realistic Delicate Fluttering Leaves)
  useEffect(() => {
    if (theme !== 'autumn' || !effectsEnabled) return;
    const canvas = autumnCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const leafColors = [
      '#ea580c', // Warm Pumpkin Orange
      '#f97316', // Golden Amber
      '#eab308', // Warm Gold
      '#d97706', // Burnt Ochre
      '#dc2626', // Scarlet Maple
      '#b45309', // Cinnamon Rust
      '#9a3412', // Deep Autumn Crimson
    ];

    // Delicate, elegant autumn leaf particles
    const leaves = Array.from({ length: 32 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 3 + 3.8, // Delicate 3.8px - 6.8px size
      speedY: Math.random() * 0.8 + 0.45,
      speedX: Math.random() * 0.9 + 0.35,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.03,
      flipAngle: Math.random() * Math.PI * 2,
      flipSpeed: Math.random() * 0.03 + 0.015,
      color: leafColors[Math.floor(Math.random() * leafColors.length)],
      swayCount: Math.random() * 100,
      swaySpeed: Math.random() * 0.02 + 0.015,
      opacity: Math.random() * 0.45 + 0.5,
      type: Math.floor(Math.random() * 3), // 0: Maple, 1: Oak, 2: Birch/Beech
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      leaves.forEach(l => {
        l.swayCount += l.swaySpeed;
        l.flipAngle += l.flipSpeed;
        l.y += l.speedY;
        l.x += Math.sin(l.swayCount) * 1.3 + l.speedX;
        l.rotation += l.rotationSpeed;

        if (l.y > height + 20) {
          l.y = -15;
          l.x = Math.random() * width;
        }
        if (l.x > width + 25) l.x = -15;

        ctx.save();
        ctx.translate(l.x, l.y);
        ctx.rotate(l.rotation);
        // 3D tumbling & fluttering perspective
        ctx.scale(Math.cos(l.flipAngle), Math.sin(l.swayCount) * 0.25 + 0.75);

        const s = l.size;
        ctx.beginPath();
        if (l.type === 0) {
          // Delicate Japanese Maple Leaf
          ctx.moveTo(0, -s);
          ctx.quadraticCurveTo(s * 0.22, -s * 0.42, s * 0.35, -s * 0.38);
          ctx.quadraticCurveTo(s * 0.85, -s * 0.45, s * 0.9, -s * 0.08);
          ctx.quadraticCurveTo(s * 0.55, s * 0.02, s * 0.7, s * 0.48);
          ctx.quadraticCurveTo(s * 0.25, s * 0.28, 0, s * 0.42);
          ctx.quadraticCurveTo(-s * 0.25, s * 0.28, -s * 0.7, s * 0.48);
          ctx.quadraticCurveTo(-s * 0.55, s * 0.02, -s * 0.9, -s * 0.08);
          ctx.quadraticCurveTo(-s * 0.85, -s * 0.45, -s * 0.35, -s * 0.38);
          ctx.quadraticCurveTo(-s * 0.22, -s * 0.42, 0, -s);
          ctx.closePath();
        } else if (l.type === 1) {
          // Delicate Oak Leaf
          ctx.moveTo(0, -s * 1.05);
          ctx.quadraticCurveTo(s * 0.45, -s * 0.75, s * 0.3, -s * 0.45);
          ctx.quadraticCurveTo(s * 0.7, -s * 0.18, s * 0.35, s * 0.1);
          ctx.quadraticCurveTo(s * 0.58, s * 0.38, s * 0.22, s * 0.65);
          ctx.quadraticCurveTo(s * 0.08, s * 0.85, 0, s * 0.95);
          ctx.quadraticCurveTo(-s * 0.08, s * 0.85, -s * 0.22, s * 0.65);
          ctx.quadraticCurveTo(-s * 0.58, s * 0.38, -s * 0.35, s * 0.1);
          ctx.quadraticCurveTo(-s * 0.7, -s * 0.18, -s * 0.3, -s * 0.45);
          ctx.quadraticCurveTo(-s * 0.45, -s * 0.75, 0, -s * 1.05);
          ctx.closePath();
        } else {
          // Teardrop Birch / Beech Leaf
          ctx.moveTo(0, -s * 1.1);
          ctx.bezierCurveTo(s * 0.65, -s * 0.55, s * 0.65, s * 0.35, 0, s * 0.85);
          ctx.bezierCurveTo(-s * 0.65, s * 0.35, -s * 0.65, -s * 0.55, 0, -s * 1.1);
          ctx.closePath();
        }

        ctx.fillStyle = l.color;
        ctx.globalAlpha = l.opacity;
        ctx.shadowBlur = 3;
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.fill();

        // Tiny delicate leaf vein
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.lineTo(0, s * 0.7);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 0.6;
        ctx.stroke();

        ctx.restore();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [theme, effectsEnabled]);

  // 4. Ramadan Twinkling Stars & Shooting Star Meteors Engine
  useEffect(() => {
    if (theme !== 'ramadan' || !effectsEnabled) return;
    const canvas = ramadanCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Background Twinkling Stars
    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * (height * 0.75),
      radius: Math.random() * 1.5 + 0.6,
      baseAlpha: Math.random() * 0.5 + 0.3,
      twinkleSpeed: Math.random() * 0.04 + 0.015,
      twinkleOffset: Math.random() * Math.PI * 2,
      color: Math.random() > 0.3 ? '#fef08a' : (Math.random() > 0.5 ? '#ffffff' : '#38bdf8'),
    }));

    // Shooting Star (Meteor) state
    let shootingStars = [];
    let nextMeteorTime = Date.now() + Math.random() * 1500 + 800;

    const createShootingStar = () => {
      const startX = Math.random() * (width * 0.8) + (width * 0.1);
      const startY = Math.random() * (height * 0.35);
      const angle = (Math.PI / 4) + (Math.random() * 0.3 - 0.15); // ~45 degrees diagonal
      const speed = Math.random() * 8 + 12;
      const length = Math.random() * 90 + 70;
      return {
        x: startX,
        y: startY,
        length,
        speed,
        dx: Math.cos(angle) * speed,
        dy: Math.sin(angle) * speed,
        opacity: 1,
        fadeRate: Math.random() * 0.02 + 0.018,
        thickness: Math.random() * 1.8 + 1.2,
        color: Math.random() > 0.4 ? '#fef08a' : '#ffffff'
      };
    };

    let tick = 0;
    const render = () => {
      tick += 0.02;
      ctx.clearRect(0, 0, width, height);

      // 1. Draw Twinkling Stars
      stars.forEach(star => {
        const alpha = star.baseAlpha + Math.sin(tick * star.twinkleSpeed * 60 + star.twinkleOffset) * 0.35;
        const finalAlpha = Math.max(0.1, Math.min(1, alpha));
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = star.color;
        ctx.globalAlpha = finalAlpha;
        ctx.shadowBlur = star.radius * 3;
        ctx.shadowColor = star.color;
        ctx.fill();
      });

      // 2. Spawn and Draw Shooting Stars (Meteors)
      const now = Date.now();
      if (now >= nextMeteorTime) {
        shootingStars.push(createShootingStar());
        nextMeteorTime = now + Math.random() * 3500 + 2000; // Next in 2-5.5s
      }

      shootingStars.forEach((meteor) => {
        meteor.x += meteor.dx;
        meteor.y += meteor.dy;
        meteor.opacity -= meteor.fadeRate;

        if (meteor.opacity > 0) {
          const tailX = meteor.x - (meteor.dx / meteor.speed) * meteor.length;
          const tailY = meteor.y - (meteor.dy / meteor.speed) * meteor.length;

          const grad = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
          grad.addColorStop(0, meteor.color);
          grad.addColorStop(0.3, `rgba(254, 240, 138, ${meteor.opacity * 0.8})`);
          grad.addColorStop(1, 'rgba(254, 240, 138, 0)');

          ctx.beginPath();
          ctx.moveTo(meteor.x, meteor.y);
          ctx.lineTo(tailX, tailY);
          ctx.strokeStyle = grad;
          ctx.lineWidth = meteor.thickness;
          ctx.lineCap = 'round';
          ctx.globalAlpha = meteor.opacity;
          ctx.shadowBlur = 10;
          ctx.shadowColor = '#fef08a';
          ctx.stroke();

          // Glowing head starburst
          ctx.beginPath();
          ctx.arc(meteor.x, meteor.y, meteor.thickness * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.globalAlpha = meteor.opacity;
          ctx.shadowBlur = 14;
          ctx.shadowColor = '#fff';
          ctx.fill();
        }
      });

      // Remove expired shooting stars
      shootingStars = shootingStars.filter(m => m.opacity > 0 && m.x < width + 100 && m.y < height + 100);

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 5. 🌌 Aurora Borealis Waves & Polar Dust Engine
  useEffect(() => {
    if (theme !== 'aurora' || !effectsEnabled) return;
    const canvas = auroraCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.7,
      radius: Math.random() * 1.8 + 0.5,
      speedY: Math.random() * 0.3 + 0.1,
      opacity: Math.random() * 0.6 + 0.2,
      color: Math.random() > 0.5 ? '#6ee7b7' : '#a78bfa'
    }));

    let t = 0;
    const render = () => {
      t += 0.008;
      ctx.clearRect(0, 0, width, height);

      // Draw flowing Aurora Curtain 1 (Emerald Green)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= width; x += 20) {
        const y = Math.sin(x * 0.003 + t) * 60 + Math.cos(x * 0.006 - t * 0.8) * 35 + 110;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, 0);
      ctx.closePath();
      const grad1 = ctx.createLinearGradient(0, 0, 0, 240);
      grad1.addColorStop(0, 'rgba(16, 185, 129, 0)');
      grad1.addColorStop(0.4, 'rgba(16, 185, 129, 0.22)');
      grad1.addColorStop(0.8, 'rgba(6, 182, 212, 0.12)');
      grad1.addColorStop(1, 'rgba(16, 185, 129, 0)');
      ctx.fillStyle = grad1;
      ctx.fill();
      ctx.restore();

      // Draw flowing Aurora Curtain 2 (Violet / Lavender)
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= width; x += 20) {
        const y = Math.cos(x * 0.004 - t * 1.2) * 55 + Math.sin(x * 0.007 + t) * 40 + 130;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, 0);
      ctx.closePath();
      const grad2 = ctx.createLinearGradient(0, 0, 0, 260);
      grad2.addColorStop(0, 'rgba(139, 92, 246, 0)');
      grad2.addColorStop(0.45, 'rgba(139, 92, 246, 0.20)');
      grad2.addColorStop(0.85, 'rgba(217, 70, 239, 0.10)');
      grad2.addColorStop(1, 'rgba(139, 92, 246, 0)');
      ctx.fillStyle = grad2;
      ctx.fill();
      ctx.restore();

      // Ice Dust Particles
      particles.forEach(p => {
        p.y -= p.speedY;
        if (p.y < 0) { p.y = height * 0.7; p.x = Math.random() * width; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 6. 🌧️ Rainy Eskişehir (Porsuk Rain Drops & Splashes Engine)
  useEffect(() => {
    if (theme !== 'rainy_eskisehir' || !effectsEnabled) return;
    const canvas = rainCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const drops = Array.from({ length: 75 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      length: Math.random() * 22 + 14,
      speedY: Math.random() * 9 + 11,
      speedX: -1.5,
      opacity: Math.random() * 0.5 + 0.25,
      thickness: Math.random() * 1.2 + 0.8
    }));

    const splashes = [];

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw Rain Drops
      drops.forEach(d => {
        d.y += d.speedY;
        d.x += d.speedX;

        if (d.y > height) {
          splashes.push({
            x: d.x,
            y: height - 10,
            radius: 1,
            maxRadius: Math.random() * 12 + 6,
            opacity: 0.6
          });
          d.y = -20;
          d.x = Math.random() * (width + 100);
        }

        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.speedX * 2, d.y + d.length);
        ctx.strokeStyle = `rgba(186, 230, 253, ${d.opacity})`;
        ctx.lineWidth = d.thickness;
        ctx.lineCap = 'round';
        ctx.stroke();
      });

      // Draw Ground Splashes
      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radius += 0.8;
        s.opacity -= 0.04;
        if (s.opacity <= 0 || s.radius >= s.maxRadius) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius * 2, s.radius * 0.6, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(224, 242, 254, ${s.opacity})`;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 7. ⚔️ Desert Gold (Swirling Golden Dust Particles Engine)
  useEffect(() => {
    if (theme !== 'desert_gold' || !effectsEnabled) return;
    const canvas = desertCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const motes = Array.from({ length: 65 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.2 + 0.6,
      speedX: Math.random() * 0.8 + 0.2,
      speedY: (Math.random() - 0.5) * 0.4,
      sway: Math.random() * 0.02 + 0.01,
      swayCount: Math.random() * 100,
      opacity: Math.random() * 0.6 + 0.25,
      color: Math.random() > 0.4 ? '#fef08a' : '#facc15'
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      motes.forEach(m => {
        m.swayCount += m.sway;
        m.x += m.speedX;
        m.y += Math.sin(m.swayCount) * 0.5 + m.speedY;

        if (m.x > width) { m.x = -10; m.y = Math.random() * height; }
        if (m.y < 0) m.y = height;
        if (m.y > height) m.y = 0;

        ctx.beginPath();
        ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
        ctx.fillStyle = m.color;
        ctx.globalAlpha = m.opacity;
        ctx.shadowBlur = m.radius * 3.5;
        ctx.shadowColor = '#eab308';
        ctx.fill();
      });

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 8. ☕ Cozy Coffee (Rising Warm Steam Waves Engine)
  useEffect(() => {
    if (theme !== 'cozy_coffee' || !effectsEnabled) return;
    const canvas = coffeeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const steams = Array.from({ length: 28 }, () => ({
      x: (width * 0.15) + (Math.random() * (width * 0.3) - width * 0.15),
      y: height - (Math.random() * (height * 0.5)),
      radius: Math.random() * 25 + 15,
      speedY: Math.random() * 0.7 + 0.4,
      sway: Math.random() * 0.02 + 0.01,
      swayCount: Math.random() * 100,
      opacity: Math.random() * 0.18 + 0.05
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      steams.forEach(s => {
        s.swayCount += s.sway;
        s.y -= s.speedY;
        s.x += Math.sin(s.swayCount) * 0.6;
        s.radius += 0.12;

        if (s.y < height * 0.25 || s.radius > 55) {
          s.y = height - 20;
          s.x = (width * 0.18) + (Math.random() * 120 - 60);
          s.radius = Math.random() * 18 + 12;
        }

        const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.radius);
        grad.addColorStop(0, `rgba(254, 243, 199, ${s.opacity})`);
        grad.addColorStop(0.6, `rgba(217, 119, 6, ${s.opacity * 0.4})`);
        grad.addColorStop(1, 'rgba(254, 243, 199, 0)');

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 9. 🎮 Retro Arcade (8-Bit Pixel Stars & Powerups Engine)
  useEffect(() => {
    if (theme !== 'retro_arcade' || !effectsEnabled) return;
    const canvas = arcadeCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const pixels = Array.from({ length: 40 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.floor(Math.random() * 4) + 3,
      speedY: Math.random() * 0.6 + 0.2,
      opacity: Math.random() * 0.7 + 0.3,
      color: ['#22c55e', '#fbbf24', '#f43f5e', '#06b6d4', '#a855f7'][Math.floor(Math.random() * 5)]
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      pixels.forEach(p => {
        p.y -= p.speedY;
        if (p.y < 0) { p.y = height; p.x = Math.random() * width; }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        // Draw crisp 8-bit pixel square
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      });

      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);

  // 10. ☀️ Tropical Summer Sunshine & Sparkling Ocean Caustics
  useEffect(() => {
    if (theme !== 'summer' || !effectsEnabled) return;
    const canvas = summerCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Warm golden sun dust, ocean glimmer & floating bubbles
    const sparkles = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2.5 + 0.8,
      speedY: Math.random() * 0.7 + 0.25,
      speedX: (Math.random() - 0.5) * 0.5,
      opacity: Math.random() * 0.75 + 0.25,
      pulseSpeed: Math.random() * 0.04 + 0.02,
      pulse: Math.random() * Math.PI * 2,
      color: ['#fef08a', '#f59e0b', '#22d3ee', '#67e8f9', '#ffffff', '#38bdf8'][Math.floor(Math.random() * 6)]
    }));

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      sparkles.forEach(s => {
        s.y -= s.speedY;
        s.x += s.speedX;
        s.pulse += s.pulseSpeed;

        if (s.y < -10) { s.y = height + 10; s.x = Math.random() * width; }
        if (s.x < 0) s.x = width;
        if (s.x > width) s.x = 0;

        const currentOpacity = Math.max(0.1, s.opacity + Math.sin(s.pulse) * 0.35);

        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.globalAlpha = currentOpacity;
        ctx.shadowColor = s.color;
        ctx.shadowBlur = s.radius > 1.8 ? 10 : 3;
        ctx.fill();
      });

      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [theme, effectsEnabled]);



  return (
    <>
      {/* ── 🎃 HALLOWEEN ATMOSPHERIC EFFECTS ── */}
      {theme === 'halloween' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          {/* Top-Left Spiderweb */}
          <svg style={{ position: 'absolute', top: 0, left: 0, width: 150, height: 150, opacity: 0.4 }} viewBox="0 0 100 100">
            <path d="M0,0 L100,0 M0,0 L85,50 M0,0 L50,85 M0,0 L0,100" stroke="#ffa94d" strokeWidth="1" fill="none" />
            <path d="M20,0 Q20,20 0,20 M40,0 Q40,40 0,40 M60,0 Q60,60 0,60 M80,0 Q80,80 0,80 M100,0 Q100,100 0,100" stroke="#ffa94d" strokeWidth="0.75" fill="none" opacity="0.6" />
          </svg>

          {/* Top-Right Spiderweb */}
          <svg style={{ position: 'absolute', top: 0, right: 0, width: 150, height: 150, opacity: 0.4, transform: 'scaleX(-1)' }} viewBox="0 0 100 100">
            <path d="M0,0 L100,0 M0,0 L85,50 M0,0 L50,85 M0,0 L0,100" stroke="#9d4edd" strokeWidth="1" fill="none" />
            <path d="M20,0 Q20,20 0,20 M40,0 Q40,40 0,40 M60,0 Q60,60 0,60 M80,0 Q80,80 0,80 M100,0 Q100,100 0,100" stroke="#9d4edd" strokeWidth="0.75" fill="none" opacity="0.6" />
          </svg>

          {/* Hanging Spider */}
          <div className="spider-hanger-container">
            <div className="spider-web-line" />
            <div className="spider-creature">🕷️</div>
          </div>

          {/* Flying Flapping Bats */}
          <div className="halloween-bat bat-1">
            <svg viewBox="0 0 50 26" width="34" height="18">
              <path
                d="M25,15 C29,8 39,2 49,6 C44,14 38,18 31,17 C28,21 22,21 19,17 C12,18 6,14 1,6 C11,2 21,8 25,15 Z"
                fill="#3c1e5c"
                className="bat-wings-flap"
              />
              <circle cx="25" cy="14" r="3" fill="#ff7700" opacity="0.9" />
            </svg>
          </div>

          <div className="halloween-bat bat-2">
            <svg viewBox="0 0 50 26" width="28" height="15">
              <path
                d="M25,15 C29,8 39,2 49,6 C44,14 38,18 31,17 C28,21 22,21 19,17 C12,18 6,14 1,6 C11,2 21,8 25,15 Z"
                fill="#4a2273"
                className="bat-wings-flap"
              />
              <circle cx="25" cy="14" r="2.5" fill="#ffa94d" opacity="0.9" />
            </svg>
          </div>

          {/* Glowing Pumpkins */}
          <div className="halloween-pumpkins-wrapper">
            <svg viewBox="0 0 240 140" className="halloween-pumpkins-svg">
              <defs>
                <filter id="candleGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <radialGradient id="pumpkinGrad1" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#ff8c1a" />
                  <stop offset="60%" stopColor="#e65100" />
                  <stop offset="100%" stopColor="#8c2500" />
                </radialGradient>
                <radialGradient id="pumpkinGrad2" cx="40%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#ffa033" />
                  <stop offset="60%" stopColor="#f55c00" />
                  <stop offset="100%" stopColor="#9e2a00" />
                </radialGradient>
                <linearGradient id="innerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="30%" stopColor="#ffea00" />
                  <stop offset="70%" stopColor="#ff7700" />
                  <stop offset="100%" stopColor="#ff2200" />
                </linearGradient>
              </defs>

              <ellipse cx="120" cy="132" rx="105" ry="8" fill="rgba(0,0,0,0.6)" />

              <g transform="translate(95, 10) scale(0.65)">
                <path d="M45,25 Q40,5 55,0 Q50,15 48,25" fill="#4a2e18" />
                <ellipse cx="45" cy="50" rx="35" ry="28" fill="url(#pumpkinGrad1)" opacity="0.85" />
                <polygon points="30,42 38,42 34,35" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <polygon points="52,42 60,42 56,35" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <path d="M26,54 Q45,68 64,54 Q45,60 26,54" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
              </g>

              <g transform="translate(5, 25)">
                <path d="M50,22 Q42,5 58,2 Q52,14 53,22" fill="#5c3818" />
                <ellipse cx="50" cy="62" rx="46" ry="40" fill="url(#pumpkinGrad1)" />
                <path d="M28,50 Q36,40 44,52 Q36,46 28,50" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <polygon points="56,52 68,42 74,52" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <polygon points="46,58 54,58 50,52" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <path d="M22,66 Q50,92 78,66 Q72,78 66,74 L66,80 Q50,86 34,78 L34,72 Q28,72 22,66 Z" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
              </g>

              <g transform="translate(115, 20)">
                <path d="M60,25 Q70,4 54,2 Q58,16 57,25" fill="#3d6611" />
                <ellipse cx="60" cy="65" rx="52" ry="44" fill="url(#pumpkinGrad2)" />
                <path d="M34,50 Q48,36 50,52 Z" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <path d="M86,50 Q72,36 70,52 Z" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <polygon points="56,60 64,60 60,53" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
                <path d="M26,68 Q60,98 94,68 Q88,80 82,74 L82,82 L74,77 L74,85 L66,80 L60,86 L54,80 L46,85 L46,77 L38,82 L38,74 Q32,80 26,68 Z" fill="url(#innerGlow)" filter="url(#candleGlow)" className="flicker-flame" />
              </g>
            </svg>
          </div>

          <style>{`
            @keyframes spiderSilkBounce {
              0% { height: 110px; }
              50% { height: 190px; }
              100% { height: 110px; }
            }
            @keyframes spiderPendulum {
              0% { transform: rotate(-10deg); }
              50% { transform: rotate(0deg); }
              100% { transform: rotate(10deg); }
            }
            .spider-hanger-container {
              position: absolute;
              top: 0;
              right: 18%;
              display: flex;
              flex-direction: column;
              align-items: center;
              transform-origin: top center;
              animation: spiderPendulum 4s ease-in-out infinite alternate;
              pointer-events: none;
              z-index: 9999;
            }
            .spider-web-line {
              width: 1.5px;
              background: linear-gradient(to bottom, rgba(255, 255, 255, 0.8), rgba(255, 255, 255, 0.25));
              box-shadow: 0 0 5px rgba(255, 255, 255, 0.9);
              animation: spiderSilkBounce 8s ease-in-out infinite;
            }
            .spider-creature {
              font-size: 26px;
              line-height: 1;
              margin-top: -6px;
              filter: drop-shadow(0 3px 8px rgba(0,0,0,0.9));
              user-select: none;
            }
            @keyframes candleFlicker {
              0% { opacity: 0.92; filter: drop-shadow(0 0 6px #ffea00); }
              25% { opacity: 1; filter: drop-shadow(0 0 16px #ff7700); }
              50% { opacity: 0.85; filter: drop-shadow(0 0 8px #ffaa00); }
              75% { opacity: 0.98; filter: drop-shadow(0 0 14px #ff5500); }
              100% { opacity: 0.92; filter: drop-shadow(0 0 6px #ffea00); }
            }
            @keyframes batWingsFlap {
              0%, 100% { transform: scaleY(1); }
              50% { transform: scaleY(0.35); }
            }
            @keyframes batFlight1 {
              0% { transform: translate(-60px, 70px); opacity: 0; }
              10% { opacity: 0.8; }
              90% { opacity: 0.8; }
              100% { transform: translate(105vw, 110px); opacity: 0; }
            }
            @keyframes batFlight2 {
              0% { transform: translate(105vw, 150px) scaleX(-1); opacity: 0; }
              10% { opacity: 0.7; }
              90% { opacity: 0.7; }
              100% { transform: translate(-60px, 90px) scaleX(-1); opacity: 0; }
            }
            .bat-wings-flap {
              transform-origin: 25px 15px;
              animation: batWingsFlap 0.22s ease-in-out infinite alternate;
            }
            .halloween-bat {
              position: absolute;
              user-select: none;
              pointer-events: none;
            }
            .bat-1 {
              top: 10%;
              animation: batFlight1 16s linear infinite;
            }
            .bat-2 {
              top: 22%;
              animation: batFlight2 22s linear 6s infinite;
            }
            .halloween-pumpkins-wrapper {
              position: absolute;
              bottom: 28px;
              right: 20px;
              width: 260px;
              max-width: 45vw;
              user-select: none;
              pointer-events: none;
              filter: drop-shadow(0 0 25px rgba(255, 119, 0, 0.3));
              transition: transform 0.3s ease;
            }
            .halloween-pumpkins-svg {
              width: 100%;
              height: auto;
              display: block;
            }
            .flicker-flame {
              animation: candleFlicker 2.5s ease-in-out infinite alternate;
            }
            @media (max-width: 768px) {
              .spider-hanger-container {
                right: 8px;
                transform: scale(0.75);
                transform-origin: top right;
              }
              .halloween-pumpkins-wrapper {
                width: 130px;
                right: 8px;
                bottom: 45px;
                opacity: 0.85;
              }
            }
          `}</style>
        </div>
      )}

      {/* ── ❄️ CHRISTMAS / NOEL ATMOSPHERIC EFFECTS ── */}
      {theme === 'christmas' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img christmas-tree-backdrop" 
              style={{ backgroundImage: `url(${christmasTreeImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            {/* Falling Multilayered Snowflakes & Golden Sparkles Canvas */}
            <canvas ref={snowCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Floating Warm Bokeh Glow Orbs in Background */}
          <div className="christmas-bokeh-container">
            <div className="bokeh-orb b1" />
            <div className="bokeh-orb b2" />
            <div className="bokeh-orb b3" />
            <div className="bokeh-orb b4" />
            <div className="bokeh-orb b5" />
          </div>

          {/* 💡 FESTIVE GLOWING FAIRY LIGHTS GARLAND ACROSS TOP */}
          <div className="christmas-fairy-garland">
            <svg viewBox="0 0 1200 45" preserveAspectRatio="none" className="fairy-wire-svg">
              <path d="M 0,5 Q 150,22 300,5 Q 450,22 600,5 Q 750,22 900,5 Q 1050,22 1200,5" fill="none" stroke="rgba(16, 185, 129, 0.45)" strokeWidth="1.8" />
            </svg>
            <div className="fairy-bulbs-track">
              {[
                { c: 'gold', d: '0s', l: '4%' },
                { c: 'red', d: '0.4s', l: '8%' },
                { c: 'green', d: '0.9s', l: '12%' },
                { c: 'blue', d: '1.4s', l: '16%' },
                { c: 'white', d: '0.2s', l: '20%' },
                { c: 'gold', d: '1.1s', l: '24%' },
                { c: 'red', d: '0.6s', l: '28%' },
                { c: 'green', d: '1.7s', l: '32%' },
                { c: 'blue', d: '0.3s', l: '36%' },
                { c: 'white', d: '1.3s', l: '40%' },
                { c: 'gold', d: '0.8s', l: '44%' },
                { c: 'red', d: '1.9s', l: '48%' },
                { c: 'green', d: '0.5s', l: '52%' },
                { c: 'blue', d: '1.2s', l: '56%' },
                { c: 'white', d: '0.1s', l: '60%' },
                { c: 'gold', d: '1.5s', l: '64%' },
                { c: 'red', d: '0.7s', l: '68%' },
                { c: 'green', d: '1.8s', l: '72%' },
                { c: 'blue', d: '0.4s', l: '76%' },
                { c: 'white', d: '1.6s', l: '80%' },
                { c: 'gold', d: '0.9s', l: '84%' },
                { c: 'red', d: '1.4s', l: '88%' },
                { c: 'green', d: '0.3s', l: '92%' },
                { c: 'blue', d: '1.0s', l: '96%' },
              ].map((b, i) => (
                <div key={i} className={`fairy-bulb bulb-${b.c}`} style={{ left: b.l, animationDelay: b.d }}>
                  <div className="bulb-socket" />
                  <div className="bulb-glass" />
                  <div className="bulb-aura" />
                </div>
              ))}
            </div>
          </div>

          {/* 🎄 HANGING CHRISTMAS ORNAMENTS (DISTRIBUTED SIDE-BY-SIDE ACROSS TOP CORNERS) */}
          <div className="christmas-hanging-wrapper">
            {/* SVG Defs for Gradients & Shadows */}
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="metalGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fff8b3" />
                  <stop offset="35%" stopColor="#fbbf24" />
                  <stop offset="70%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#78350f" />
                </linearGradient>
                <linearGradient id="metalSilver" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="#e2e8f0" />
                  <stop offset="80%" stopColor="#94a3b8" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <radialGradient id="glossyRedBauble" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#ff4d4d" />
                  <stop offset="40%" stopColor="#f43f5e" />
                  <stop offset="85%" stopColor="#9f1239" />
                  <stop offset="100%" stopColor="#4c0519" />
                </radialGradient>
                <linearGradient id="goldCap" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="50%" stopColor="#fef08a" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <filter id="baubleGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="6" stdDeviation="5" floodOpacity="0.4" />
                </filter>
              </defs>
            </svg>

            {/* ── LEFT CLUSTER (Side by Side) ── */}
            {/* 1. Pearl Silver Bauble */}
            <div className="hanging-tree-item sway-1 tree-item-left-1" style={{ left: '15px' }}>
              <div className="gold-wire" style={{ height: '125px' }} />
              <svg viewBox="0 0 44 48" width="38" height="42">
                <rect x="18" y="0" width="8" height="5" fill="url(#goldCap)" rx="1" />
                <circle cx="22" cy="24" r="19" fill="url(#metalSilver)" filter="url(#baubleGlow)" />
                <ellipse cx="16" cy="18" rx="5" ry="3" fill="#ffffff" opacity="0.85" />
              </svg>
            </div>

            {/* 2. Snowflake Pendant */}
            <div className="hanging-tree-item sway-2 tree-item-left-2" style={{ left: '60px' }}>
              <div className="gold-wire" style={{ height: '95px' }} />
              <svg viewBox="0 0 36 40" width="32" height="36">
                <rect x="15" y="0" width="6" height="4" fill="url(#goldCap)" rx="1" />
                <circle cx="18" cy="20" r="15" fill="url(#metalSilver)" filter="url(#baubleGlow)" />
                <text x="18" y="26" textAnchor="middle" fontSize="16" fill="#ffffff">❄</text>
              </svg>
            </div>

            {/* 3. Large Royal Red Snowflake Bauble */}
            <div className="hanging-tree-item sway-3 tree-item-desktop-only" style={{ left: '110px' }}>
              <div className="gold-wire" style={{ height: '165px' }} />
              <svg viewBox="0 0 58 64" width="48" height="54">
                <ellipse cx="24" cy="3" rx="4.5" ry="2.8" fill="url(#metalGold)" />
                <ellipse cx="34" cy="3" rx="4.5" ry="2.8" fill="url(#metalGold)" />
                <rect x="23" y="5" width="12" height="6" fill="url(#goldCap)" rx="1.5" />
                <circle cx="29" cy="34" r="26" fill="url(#glossyRedBauble)" filter="url(#baubleGlow)" />
                <text x="29" y="42" textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.95)">❄</text>
                <circle cx="15" cy="26" r="1.5" fill="#fff" opacity="0.8" />
                <circle cx="43" cy="26" r="1.5" fill="#fff" opacity="0.8" />
                <ellipse cx="20" cy="24" rx="8" ry="4" transform="rotate(-25 20 24)" fill="#ffffff" opacity="0.45" />
              </svg>
            </div>

            {/* 4. Metallic Gold Bauble */}
            <div className="hanging-tree-item sway-4 tree-item-desktop-only" style={{ left: '170px' }}>
              <div className="gold-wire" style={{ height: '130px' }} />
              <svg viewBox="0 0 44 48" width="38" height="42">
                <rect x="18" y="0" width="8" height="5" fill="url(#goldCap)" rx="1" />
                <circle cx="22" cy="24" r="19" fill="url(#metalGold)" filter="url(#baubleGlow)" />
                <ellipse cx="16" cy="18" rx="5" ry="3" fill="#ffffff" opacity="0.75" />
              </svg>
            </div>

            {/* ── RIGHT CLUSTER (Side by Side) ── */}
            {/* 5. Metallic Gold Bauble */}
            <div className="hanging-tree-item sway-4 tree-item-desktop-only" style={{ right: '170px' }}>
              <div className="gold-wire" style={{ height: '130px' }} />
              <svg viewBox="0 0 44 48" width="38" height="42">
                <rect x="18" y="0" width="8" height="5" fill="url(#goldCap)" rx="1" />
                <circle cx="22" cy="24" r="19" fill="url(#metalGold)" filter="url(#baubleGlow)" />
                <ellipse cx="16" cy="18" rx="5" ry="3" fill="#ffffff" opacity="0.75" />
              </svg>
            </div>

            {/* 6. Large Royal Red Snowflake Bauble */}
            <div className="hanging-tree-item sway-3 tree-item-desktop-only" style={{ right: '110px' }}>
              <div className="gold-wire" style={{ height: '165px' }} />
              <svg viewBox="0 0 58 64" width="48" height="54">
                <ellipse cx="24" cy="3" rx="4.5" ry="2.8" fill="url(#metalGold)" />
                <ellipse cx="34" cy="3" rx="4.5" ry="2.8" fill="url(#metalGold)" />
                <rect x="23" y="5" width="12" height="6" fill="url(#goldCap)" rx="1.5" />
                <circle cx="29" cy="34" r="26" fill="url(#glossyRedBauble)" filter="url(#baubleGlow)" />
                <text x="29" y="42" textAnchor="middle" fontSize="24" fill="rgba(255,255,255,0.95)">❄</text>
                <circle cx="15" cy="26" r="1.5" fill="#fff" opacity="0.8" />
                <circle cx="43" cy="26" r="1.5" fill="#fff" opacity="0.8" />
                <ellipse cx="20" cy="24" rx="8" ry="4" transform="rotate(-25 20 24)" fill="#ffffff" opacity="0.45" />
              </svg>
            </div>

            {/* 7. Snowflake Pendant */}
            <div className="hanging-tree-item sway-2 tree-item-right-2" style={{ right: '60px' }}>
              <div className="gold-wire" style={{ height: '95px' }} />
              <svg viewBox="0 0 36 40" width="32" height="36">
                <rect x="15" y="0" width="6" height="4" fill="url(#goldCap)" rx="1" />
                <circle cx="18" cy="20" r="15" fill="url(#metalSilver)" filter="url(#baubleGlow)" />
                <text x="18" y="26" textAnchor="middle" fontSize="16" fill="#ffffff">❄</text>
              </svg>
            </div>

            {/* 8. Pearl Silver Bauble */}
            <div className="hanging-tree-item sway-1 tree-item-right-1" style={{ right: '15px' }}>
              <div className="gold-wire" style={{ height: '125px' }} />
              <svg viewBox="0 0 44 48" width="38" height="42">
                <rect x="18" y="0" width="8" height="5" fill="url(#goldCap)" rx="1" />
                <circle cx="22" cy="24" r="19" fill="url(#metalSilver)" filter="url(#baubleGlow)" />
                <ellipse cx="16" cy="18" rx="5" ry="3" fill="#ffffff" opacity="0.85" />
              </svg>
            </div>
          </div>

          {/* 🎄 Cozy Bottom-Right Christmas & New Year Badge */}
          <div className="christmas-festive-badge">
            <div className="christmas-badge-card">
              <span className="christmas-tree-icon">🎄</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span className="christmas-badge-title">YILBAŞI & NOEL MASALI ✨</span>
                <span className="christmas-badge-sub">MERRY CHRISTMAS & HAPPY NEW YEAR ❄️</span>
              </div>
              <span className="christmas-bell-icon">🔔</span>
            </div>
          </div>

          <style>{`
            /* 💡 Glowing Fairy Lights Garland */
            .christmas-fairy-garland {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 40px;
              pointer-events: none;
              user-select: none;
              z-index: 9994;
            }
            .fairy-wire-svg {
              width: 100%;
              height: 25px;
              position: absolute;
              top: 0;
              left: 0;
            }
            .fairy-bulbs-track {
              position: relative;
              width: 100%;
              height: 100%;
            }
            .fairy-bulb {
              position: absolute;
              top: 8px;
              width: 12px;
              height: 18px;
              display: flex;
              flex-direction: column;
              align-items: center;
              animation: fairyTwinkle 2.2s ease-in-out infinite alternate;
              transform-origin: top center;
            }
            .bulb-socket {
              width: 5px;
              height: 4px;
              background: #064e3b;
              border-radius: 1px;
            }
            .bulb-glass {
              width: 10px;
              height: 14px;
              border-radius: 50% 50% 45% 45%;
              position: relative;
            }
            .bulb-aura {
              position: absolute;
              inset: -8px;
              border-radius: 50%;
              pointer-events: none;
              opacity: 0.8;
            }

            .bulb-gold .bulb-glass { background: #fbbf24; box-shadow: 0 0 8px #f59e0b; }
            .bulb-red .bulb-glass { background: #dc2626; box-shadow: 0 0 8px #b91c1c; }
            .bulb-green .bulb-glass { background: #10b981; box-shadow: 0 0 8px #059669; }
            .bulb-blue .bulb-glass { background: #38bdf8; box-shadow: 0 0 8px #0284c7; }
            .bulb-white .bulb-glass { background: #fffbeb; box-shadow: 0 0 8px #fef08a; }

            @keyframes fairyTwinkle {
              0% { opacity: 0.5; transform: scale3d(0.92, 0.92, 1); }
              50% { opacity: 1; transform: scale3d(1.08, 1.08, 1); }
              100% { opacity: 0.65; transform: scale3d(0.96, 0.96, 1); }
            }

            .christmas-hanging-wrapper {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 260px;
              pointer-events: none;
              user-select: none;
              z-index: 9993;
            }
            .hanging-tree-item {
              position: absolute;
              top: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              transform-origin: top center;
              will-change: transform;
              transform: translate3d(0, 0, 0);
            }
            .gold-wire {
              width: 1.5px;
              background: linear-gradient(to bottom, #fff8b3, #fbbf24, #d97706);
            }

            @keyframes ornamentPendulum1 {
              0% { transform: rotate3d(0, 0, 1, -4deg); }
              50% { transform: rotate3d(0, 0, 1, 3.5deg); }
              100% { transform: rotate3d(0, 0, 1, -4deg); }
            }
            @keyframes ornamentPendulum2 {
              0% { transform: rotate3d(0, 0, 1, 4deg); }
              50% { transform: rotate3d(0, 0, 1, -3.5deg); }
              100% { transform: rotate3d(0, 0, 1, 4deg); }
            }
            .sway-1 { animation: ornamentPendulum1 5.2s ease-in-out infinite; }
            .sway-2 { animation: ornamentPendulum2 6s ease-in-out infinite 0.3s; }
            .sway-3 { animation: ornamentPendulum1 6.8s ease-in-out infinite 0.6s; }
            .sway-4 { animation: ornamentPendulum2 5.5s ease-in-out infinite 0.2s; }

            /* 🎄 Festive Christmas Badge */
            .christmas-festive-badge {
              position: absolute;
              bottom: 24px;
              right: 18px;
              user-select: none;
              pointer-events: none;
              z-index: 9992;
            }
            .christmas-badge-card {
              display: flex;
              align-items: center;
              gap: 8px;
              background: rgba(10, 31, 24, 0.94);
              border: 1px solid rgba(251, 191, 36, 0.45);
              border-left: 3px solid #dc2626;
              border-radius: 6px;
              padding: 5px 12px;
              box-shadow: 0 4px 20px rgba(0, 0, 0, 0.6), 0 0 16px rgba(220, 38, 38, 0.25);
            }
            .christmas-tree-icon {
              font-size: 16px;
              filter: drop-shadow(0 0 6px #10b981);
            }
            .christmas-bell-icon {
              font-size: 14px;
              filter: drop-shadow(0 0 6px #fbbf24);
              animation: bellJingle 3.5s ease-in-out infinite;
            }
            @keyframes bellJingle {
              0%, 75%, 100% { transform: rotate(0); }
              80% { transform: rotate(14deg); }
              85% { transform: rotate(-14deg); }
              90% { transform: rotate(10deg); }
              95% { transform: rotate(-6deg); }
            }
            .christmas-badge-title {
              font-size: 9.5px;
              font-weight: 800;
              color: #fef08a;
              letter-spacing: 0.8px;
            }
            .christmas-badge-sub {
              font-size: 7.5px;
              font-weight: 600;
              color: #94a3b8;
              letter-spacing: 0.4px;
            }

            @media (max-width: 768px) {
              .tree-item-desktop-only {
                display: none !important;
              }
              .christmas-fairy-garland {
                opacity: 0.75;
              }
              .tree-item-left-1 { left: 8px !important; transform: scale(0.85); transform-origin: top center; }
              .tree-item-left-2 { left: 45px !important; transform: scale(0.85); transform-origin: top center; }
              .tree-item-right-1 { right: 8px !important; transform: scale(0.85); transform-origin: top center; }
              .tree-item-right-2 { right: 45px !important; transform: scale(0.85); transform-origin: top center; }
              .christmas-festive-badge {
                bottom: 45px;
                right: 8px;
                transform: scale(0.85);
                transform-origin: bottom right;
              }
            }

            .christmas-ambient-glow {
              position: absolute;
              inset: 0;
              pointer-events: none;
              background: radial-gradient(circle at 80% 20%, rgba(251, 191, 36, 0.06) 0%, transparent 60%);
            }
          `}</style>
        </div>
        </>
      )}

      {/* ── 🌸 SAKURA (KİRAZ ÇİÇEĞİ) ATMOSPHERIC EFFECTS ── */}
      {theme === 'sakura' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          <canvas ref={sakuraCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          <div className="sakura-branch-top-right">
            <svg viewBox="0 0 260 180" width="240" height="165">
              <defs>
                <radialGradient id="sakuraPetalGrad" cx="30%" cy="30%" r="70%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="40%" stopColor="#fce7f3" />
                  <stop offset="85%" stopColor="#f472b6" />
                  <stop offset="100%" stopColor="#db2777" />
                </radialGradient>
              </defs>
              <path d="M260,0 Q180,30 140,50 Q110,65 70,80 M160,40 Q130,20 100,25 M120,60 Q100,90 60,110" stroke="#5c2c20" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.85" />
              <g transform="translate(140, 50) scale(0.9)">
                <circle cx="0" cy="0" r="3" fill="#be185d" />
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="3" fill="#fbbf24" />
              </g>
              <g transform="translate(100, 25) scale(0.8)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
              </g>
              <g transform="translate(70, 80) scale(0.85)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
              </g>
              <g transform="translate(60, 110) scale(0.75)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="2" fill="#fbbf24" />
              </g>
              <g transform="translate(190, 25) scale(0.95)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="3" fill="#fbbf24" />
              </g>
            </svg>
          </div>

          <div className="sakura-branch-bottom-left">
            <svg viewBox="0 0 260 180" width="240" height="165" style={{ transform: 'scaleX(-1) scaleY(-1)' }}>
              <path d="M260,0 Q180,30 140,50 Q110,65 70,80 M160,40 Q130,20 100,25 M120,60 Q100,90 60,110" stroke="#5c2c20" strokeWidth="4.5" strokeLinecap="round" fill="none" opacity="0.85" />
              <g transform="translate(140, 50) scale(0.9)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="3" fill="#fbbf24" />
              </g>
              <g transform="translate(100, 25) scale(0.8)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
              </g>
              <g transform="translate(70, 80) scale(0.85)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="2.5" fill="#fbbf24" />
              </g>
              <g transform="translate(190, 25) scale(0.95)">
                {[0, 72, 144, 216, 288].map((deg, i) => (
                  <ellipse key={i} cx="0" cy="-10" rx="6" ry="9" transform={`rotate(${deg})`} fill="url(#sakuraPetalGrad)" opacity="0.95" />
                ))}
                <circle cx="0" cy="0" r="3" fill="#fbbf24" />
              </g>
            </svg>
          </div>

          <style>{`
            .sakura-branch-top-right {
              position: absolute;
              top: 0;
              right: 0;
              user-select: none;
              pointer-events: none;
              filter: drop-shadow(0 4px 12px rgba(244, 114, 182, 0.35));
              animation: branchSway 6s ease-in-out infinite alternate;
              transform-origin: top right;
            }
            .sakura-branch-bottom-left {
              position: absolute;
              bottom: 26px;
              left: 0;
              user-select: none;
              pointer-events: none;
              filter: drop-shadow(0 4px 12px rgba(244, 114, 182, 0.35));
              animation: branchSwayBottom 7s ease-in-out infinite alternate;
              transform-origin: bottom left;
            }
            @keyframes branchSway {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(-2deg); }
            }
            @keyframes branchSwayBottom {
              0% { transform: scaleX(-1) scaleY(-1) rotate(0deg); }
              100% { transform: scaleX(-1) scaleY(-1) rotate(2deg); }
            }
            @media (max-width: 768px) {
              .sakura-branch-top-right {
                width: 130px;
                height: 90px;
                right: -10px;
                top: -5px;
              }
              .sakura-branch-bottom-left {
                width: 120px;
                height: 85px;
                left: -10px;
                bottom: 45px;
              }
            }
          `}</style>
        </div>
      )}

      {/* ── ⚡ CYBERPUNK 2077 (NIGHT CITY HUD & 3D CYBER GRID) ── */}
      {theme === 'cyberpunk' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          
          {/* 1. 3D Perspective Night City Grid Horizon (Electric Yellow & Cyan) */}
          <div className="nc-horizon-container">
            <div className="nc-horizon-glow" />
            <div className="nc-perspective-grid" />
          </div>

          {/* 2. Floating High-Voltage Sparks & Data Packets */}
          <div className="nc-particles-container">
            <div className="nc-spark ncs-1" />
            <div className="nc-spark ncs-2" />
            <div className="nc-spark ncs-3" />
            <div className="nc-spark ncs-4" />
            <div className="nc-spark ncs-5" />
            <div className="nc-spark ncs-6" />
          </div>

          {/* 3. Top-Center Kiroshi Compass & Navigation Telemetry */}
          <div className="nc-hud-top-center">
            <div className="nc-hud-compass">
              <span className="nc-compass-arrow">▼</span>
              <span className="nc-compass-code">077° // NET.INTERFACE // LIVE_CHANNEL: #DEMO-SYS</span>
              <span className="nc-compass-ticks">| | | | | | | | | | | | |</span>
            </div>
          </div>

          {/* 4. Kiroshi Optics Tactical Corner Reticles */}
          <div className="nc-hud-bracket nc-bracket-tl">
            <svg viewBox="0 0 50 50" width="38" height="38">
              <path d="M2,46 L2,8 L8,2 L46,2" stroke="#fcee0a" strokeWidth="2.5" fill="none" opacity="0.95" />
              <rect x="6" y="6" width="4" height="4" fill="#00f0ff" opacity="0.9" />
              <line x1="2" y1="20" x2="14" y2="20" stroke="#fcee0a" strokeWidth="1.5" opacity="0.6" />
            </svg>
            <div className="nc-hud-label nc-label-tl">
              <span className="nc-label-main">NC.NET // SYS_ID: #77-SYS</span>
              <span className="nc-label-sub">DIRECT FEED // PING: 1.2ms [LOCKED]</span>
            </div>
          </div>

          <div className="nc-hud-bracket nc-bracket-tr">
            <div className="nc-hud-label nc-label-tr">
              <span className="nc-label-main" style={{ color: '#00f0ff' }}>KIROSHI OPTICS v3.4</span>
              <span className="nc-label-sub">SYS_FEED [ |||||||||| 99.8% ]</span>
            </div>
            <svg viewBox="0 0 50 50" width="38" height="38" style={{ transform: 'scaleX(-1)' }}>
              <path d="M2,46 L2,8 L8,2 L46,2" stroke="#00f0ff" strokeWidth="2.5" fill="none" opacity="0.95" />
              <rect x="6" y="6" width="4" height="4" fill="#fcee0a" opacity="0.9" />
              <line x1="2" y1="20" x2="14" y2="20" stroke="#00f0ff" strokeWidth="1.5" opacity="0.6" />
            </svg>
          </div>

          <div className="nc-hud-bracket nc-bracket-br">
            <svg viewBox="0 0 50 50" width="38" height="38" style={{ transform: 'scale(-1, -1)' }}>
              <path d="M2,46 L2,8 L8,2 L46,2" stroke="#fcee0a" strokeWidth="2.5" fill="none" opacity="0.95" />
              <polygon points="6,6 12,6 6,12" fill="#ff003c" opacity="0.9" />
            </svg>
          </div>

          {/* 5. Bottom-Left Night City 2077 HUD Status Badge */}
          <div className="nc-hud-badge-bl">
            <div className="nc-badge-card">
              <span className="nc-pulse-dot" />
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span className="nc-badge-title">⚡ NIGHT CITY // CYBERPUNK 2077</span>
                <span className="nc-badge-meta">PROTOCOL: SAMURAI // SEC: BYPASS_ACTIVE</span>
              </div>
            </div>
          </div>

          <style>{`
            /* 100% Hardware-Accelerated Static Cyber Grid Horizon (Zero CPU repaint lag) */
            .nc-horizon-container {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 120px;
              overflow: hidden;
              pointer-events: none;
              opacity: 0.65;
            }
            .nc-horizon-glow {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              height: 2px;
              background: linear-gradient(90deg, transparent 5%, #fcee0a 30%, #00f0ff 70%, transparent 95%);
              box-shadow: 0 0 14px #fcee0a, 0 0 24px #00f0ff;
            }
            .nc-perspective-grid {
              position: absolute;
              inset: 0;
              background-image: 
                linear-gradient(to right, rgba(0, 240, 255, 0.18) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(252, 238, 10, 0.12) 1px, transparent 1px);
              background-size: 40px 20px;
              opacity: 0.5;
            }

            /* Floating High-Voltage Sparks (Hardware Accelerated Translate3d) */
            .nc-particles-container {
              position: absolute;
              inset: 0;
              pointer-events: none;
              overflow: hidden;
            }
            .nc-spark {
              position: absolute;
              border-radius: 50%;
              will-change: transform, opacity;
              animation: ncSparkRise 8s ease-in-out infinite;
            }
            .ncs-1 {
              width: 3px; height: 3px; left: 18%; bottom: 20px;
              background: #fcee0a; box-shadow: 0 0 6px #fcee0a;
              animation-duration: 7s; animation-delay: 0s;
            }
            .ncs-2 {
              width: 3.5px; height: 3.5px; left: 42%; bottom: 30px;
              background: #00f0ff; box-shadow: 0 0 8px #00f0ff;
              animation-duration: 8.5s; animation-delay: 1.8s;
            }
            .ncs-3 {
              width: 2.5px; height: 2.5px; left: 68%; bottom: 15px;
              background: #ff003c; box-shadow: 0 0 6px #ff003c;
              animation-duration: 6.5s; animation-delay: 1.2s;
            }
            .ncs-4 {
              width: 3px; height: 3px; left: 82%; bottom: 25px;
              background: #fcee0a; box-shadow: 0 0 6px #fcee0a;
              animation-duration: 8s; animation-delay: 2.8s;
            }
            .ncs-5 {
              width: 3px; height: 3px; left: 32%; bottom: 12px;
              background: #00f0ff; box-shadow: 0 0 6px #00f0ff;
              animation-duration: 9.5s; animation-delay: 4s;
            }
            .ncs-6 {
              width: 2px; height: 2px; left: 58%; bottom: 18px;
              background: #fcee0a; box-shadow: 0 0 5px #fcee0a;
              animation-duration: 7.2s; animation-delay: 0.8s;
            }
            @keyframes ncSparkRise {
              0% { transform: translate3d(0, 0, 0) scale(0.6); opacity: 0; }
              20% { opacity: 0.85; }
              80% { opacity: 0.85; }
              100% { transform: translate3d(0, -75vh, 0) scale(1.1); opacity: 0; }
            }

            /* Top Center Compass (Clean GPU rendering, no blur filter) */
            .nc-hud-top-center {
              position: absolute;
              top: 4px;
              left: 50%;
              transform: translateX(-50%);
              user-select: none;
              pointer-events: none;
              z-index: 9992;
            }
            .nc-hud-compass {
              display: flex;
              align-items: center;
              gap: 8px;
              background: rgba(7, 8, 12, 0.94);
              border: 1px solid rgba(252, 238, 10, 0.35);
              border-top: none;
              border-radius: 0 0 6px 6px;
              padding: 2px 10px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.5);
            }
            .nc-compass-arrow {
              color: #fcee0a;
              font-size: 8px;
            }
            .nc-compass-code {
              font-size: 8.5px;
              font-family: monospace;
              color: #00f0ff;
              letter-spacing: 1px;
              font-weight: 700;
            }
            .nc-compass-ticks {
              font-size: 8px;
              font-family: monospace;
              color: rgba(252, 238, 10, 0.4);
              letter-spacing: 2px;
            }

            /* Corner Brackets */
            .nc-hud-bracket {
              position: absolute;
              user-select: none;
              pointer-events: none;
              z-index: 9991;
              display: flex;
              align-items: flex-start;
              gap: 8px;
            }
            .nc-bracket-tl { top: 6px; left: 8px; }
            .nc-bracket-tr { top: 6px; right: 8px; }
            .nc-bracket-br { bottom: 6px; right: 8px; }

            .nc-hud-label {
              display: flex;
              flex-direction: column;
              gap: 1px;
              font-family: monospace;
            }
            .nc-label-tl { margin-top: 4px; }
            .nc-label-tr { margin-top: 4px; text-align: right; }
            .nc-label-main {
              font-size: 9px;
              font-weight: 800;
              color: #fcee0a;
              letter-spacing: 1px;
            }
            .nc-label-sub {
              font-size: 7.5px;
              color: #94a3b8;
              letter-spacing: 0.5px;
            }

            /* Bottom-Left Night City HUD Badge */
            .nc-hud-badge-bl {
              position: absolute;
              bottom: 26px;
              left: 16px;
              user-select: none;
              pointer-events: none;
              z-index: 9992;
            }
            .nc-badge-card {
              display: flex;
              align-items: center;
              gap: 8px;
              background: rgba(7, 8, 12, 0.94);
              border: 1px solid #1e283a;
              border-left: 3px solid #fcee0a;
              border-right: 2px solid #00f0ff;
              border-radius: 3px;
              padding: 5px 10px;
              box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
            }
            .nc-pulse-dot {
              width: 7px;
              height: 7px;
              border-radius: 50%;
              background: #fcee0a;
              box-shadow: 0 0 8px #fcee0a;
              animation: ncDotPulse 2s infinite ease-in-out;
            }
            @keyframes ncDotPulse {
              0%, 100% { opacity: 1; transform: scale(1); }
              50% { opacity: 0.4; transform: scale(0.7); }
            }
            .nc-badge-title {
              font-size: 9.5px;
              font-weight: 900;
              color: #fcee0a;
              font-family: monospace;
              letter-spacing: 1px;
            }
            .nc-badge-meta {
              font-size: 8px;
              color: #00f0ff;
              font-family: monospace;
              letter-spacing: 0.6px;
            }

            @media (max-width: 768px) {
              .nc-hud-badge-bl {
                bottom: 45px;
                left: 10px;
                transform: scale(0.85);
                transform-origin: bottom left;
              }
              .nc-horizon-container {
                height: 80px;
              }
              .nc-hud-bracket svg {
                width: 24px;
                height: 24px;
              }
              .nc-hud-label {
                display: none;
              }
              .nc-hud-top-center {
                display: none;
              }
            }
          `}</style>
        </div>
      )}

      {/* ── 🍂 AUTUMN (SONBAHAR) ATMOSPHERIC EFFECTS ── */}
      {theme === 'autumn' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          {/* Falling Autumn Leaves Canvas */}
          <canvas ref={autumnCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Warm Amber Bokeh Glow */}
          <div className="autumn-bokeh-container">
            <div className="autumn-orb ao-1" />
            <div className="autumn-orb ao-2" />
            <div className="autumn-orb ao-3" />
          </div>

          {/* Top-Right Delicate Autumn Branch */}
          <div className="autumn-branch-top-right">
            <svg viewBox="0 0 240 180" width="130" height="98">
              <defs>
                <linearGradient id="mapleOrange" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fb923c" />
                  <stop offset="60%" stopColor="#ea580c" />
                  <stop offset="100%" stopColor="#9a3412" />
                </linearGradient>
                <linearGradient id="mapleGold" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fde047" />
                  <stop offset="60%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#a16207" />
                </linearGradient>
                <linearGradient id="mapleRed" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f87171" />
                  <stop offset="60%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#7f1d1d" />
                </linearGradient>
              </defs>

              {/* Wooden Branch */}
              <path d="M240,0 Q170,25 130,45 Q90,65 50,80 M150,35 Q115,15 85,20 M110,55 Q85,85 45,100" stroke="#451a03" strokeWidth="3" strokeLinecap="round" fill="none" opacity="0.85" />

              {/* Delicate Maple Leaf 1 */}
              <g transform="translate(130, 45) scale(0.48) rotate(-15)">
                <path d="M0,0 Q-15,-15 -25,-5 Q-15,5 0,0 M0,0 Q15,-15 25,-5 Q15,5 0,0 M0,0 Q-10,-30 0,-35 Q10,-30 0,0" fill="url(#mapleOrange)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
              </g>
              {/* Delicate Maple Leaf 2 */}
              <g transform="translate(85, 20) scale(0.42) rotate(20)">
                <path d="M0,0 Q-15,-15 -25,-5 Q-15,5 0,0 M0,0 Q15,-15 25,-5 Q15,5 0,0 M0,0 Q-10,-30 0,-35 Q10,-30 0,0" fill="url(#mapleGold)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
              </g>
              {/* Delicate Maple Leaf 3 */}
              <g transform="translate(45, 100) scale(0.44) rotate(-35)">
                <path d="M0,0 Q-15,-15 -25,-5 Q-15,5 0,0 M0,0 Q15,-15 25,-5 Q15,5 0,0 M0,0 Q-10,-30 0,-35 Q10,-30 0,0" fill="url(#mapleRed)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))" />
              </g>

              {/* Hanging Acorn */}
              <g transform="translate(165, 30)" className="hanging-acorn">
                <line x1="0" y1="0" x2="0" y2="14" stroke="#78350f" strokeWidth="1.2" />
                <path d="M-4,14 Q0,12 4,14 Q3,17 -4,17 Z" fill="#451a03" />
                <ellipse cx="0" cy="20" rx="3.5" ry="4.5" fill="#92400e" />
              </g>
            </svg>
          </div>

          <style>{`
            .autumn-branch-top-right {
              position: absolute;
              top: 0;
              right: 0;
              user-select: none;
              pointer-events: none;
              z-index: 9992;
              filter: drop-shadow(0 3px 8px rgba(249, 115, 22, 0.2));
              animation: autumnBranchSway 6s ease-in-out infinite alternate;
              transform-origin: top right;
            }
            @keyframes autumnBranchSway {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(-2deg); }
            }
            .hanging-acorn {
              transform-origin: top center;
              animation: acornSway 4s ease-in-out infinite alternate;
            }
            @keyframes acornSway {
              0% { transform: rotate(-6deg); }
              100% { transform: rotate(6deg); }
            }
            @media (max-width: 768px) {
              .autumn-branch-top-right {
                width: 85px;
                height: 64px;
                right: -6px;
                top: -3px;
              }
            }
            .autumn-bokeh-container {
              position: absolute;
              inset: 0;
              pointer-events: none;
            }
            .autumn-orb {
              position: absolute;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(249, 115, 22, 0.18) 0%, rgba(234, 179, 8, 0.04) 60%, transparent 80%);
              filter: blur(14px);
              animation: autumnOrbFloat 9s ease-in-out infinite alternate;
            }
            .ao-1 { width: 160px; height: 160px; top: 15%; left: 20%; }
            .ao-2 { width: 200px; height: 200px; bottom: 20%; right: 15%; animation-duration: 12s; }
            .ao-3 { width: 120px; height: 120px; top: 55%; left: 40%; animation-duration: 8s; }
            @keyframes autumnOrbFloat {
              0% { transform: translate(0, 0) scale(1); opacity: 0.5; }
              100% { transform: translate(25px, -20px) scale(1.2); opacity: 0.85; }
            }
          `}</style>
        </div>
      )}

      {/* ── ☀️ SUMMER (YAZ / TROPİK SAHİL CENNETİ) ATMOSPHERIC EFFECTS ── */}
      {theme === 'summer' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          {/* Canvas Sun Sparkles, Golden Caustics & Sea Mist */}
          <canvas ref={summerCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Tropical Paradise Beach Backdrop Art */}
          <div 
            className="theme-backdrop-img summer-backdrop" 
            style={{ backgroundImage: `url(${summerBeachImg})` }} 
          />

          {/* Top-Right Radiant Tropical Sun with Dynamic Solar Flare */}
          <div className="summer-sun-container">
            <svg viewBox="0 0 160 160" width="140" height="140" className="summer-sun-svg">
              <defs>
                <radialGradient id="sunCoreGrad" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#ffffff" />
                  <stop offset="35%" stopColor="#fef08a" />
                  <stop offset="70%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </radialGradient>
                <filter id="sunGlow" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Rotating Golden Solar Rays */}
              <g className="sun-rays-spin" transform="translate(130, 30)">
                {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg, i) => (
                  <line
                    key={i}
                    x1="0"
                    y1={i % 2 === 0 ? "34" : "30"}
                    x2="0"
                    y2={i % 2 === 0 ? "52" : "42"}
                    stroke={i % 2 === 0 ? "#fde047" : "#fbbf24"}
                    strokeWidth={i % 2 === 0 ? "3" : "2"}
                    strokeLinecap="round"
                    transform={`rotate(${deg})`}
                    opacity="0.9"
                  />
                ))}
              </g>

              {/* Glowing Sun Core */}
              <circle cx="130" cy="30" r="26" fill="url(#sunCoreGrad)" filter="url(#sunGlow)" className="sun-pulse-anim" />
            </svg>
          </div>

          {/* Hanging Tropical Summer Charms (Coconut, Palm, Surfboard, Sun) */}
          <div className="theme-hanging-bar">
            <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
              <div className="decor-chain" style={{ height: '95px', background: 'linear-gradient(to bottom, #fde68a, #f59e0b, #d97706)' }} />
              <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #f59e0b)' }}>🥥</span>
            </div>
            <div className="hanging-decor sway-decor-2" style={{ left: '75px' }}>
              <div className="decor-chain" style={{ height: '125px', background: 'linear-gradient(to bottom, #a7f3d0, #10b981)' }} />
              <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 10px #10b981)' }}>🌴</span>
            </div>
            <div className="hanging-decor sway-decor-1" style={{ right: '20px' }}>
              <div className="decor-chain" style={{ height: '100px', background: 'linear-gradient(to bottom, #67e8f9, #06b6d4, #0284c7)' }} />
              <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #06b6d4)' }}>🏄‍♂️</span>
            </div>
            <div className="hanging-decor sway-decor-2" style={{ right: '75px' }}>
              <div className="decor-chain" style={{ height: '130px', background: 'linear-gradient(to bottom, #fef08a, #fbbf24)' }} />
              <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 10px #f59e0b)' }}>☀️</span>
            </div>
          </div>

          <style>{`
            .summer-sun-container {
              position: absolute;
              top: 0;
              right: 0;
              user-select: none;
              pointer-events: none;
              z-index: 9992;
            }
            .sun-rays-spin {
              animation: sunRaySpin 24s linear infinite;
            }
            @keyframes sunRaySpin {
              0% { transform: translate(130px, 30px) rotate(0deg); }
              100% { transform: translate(130px, 30px) rotate(360deg); }
            }
            .sun-pulse-anim {
              animation: sunPulse 3.5s ease-in-out infinite alternate;
            }
            @keyframes sunPulse {
              0% { transform: scale(1); filter: drop-shadow(0 0 12px #f59e0b); }
              100% { transform: scale(1.06); filter: drop-shadow(0 0 30px #f59e0b); }
            }
            @media (max-width: 768px) {
              .summer-sun-container {
                transform: scale(0.65);
                transform-origin: top right;
              }
            }
          `}</style>
        </div>
      )}

      {/* ── 🌙 RAMADAN (ŞEHR-İ RAMAZAN) ATMOSPHERIC EFFECTS ── */}
      {theme === 'ramadan' && effectsEnabled && (
        <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
          {/* Twinkling Starfield & Shooting Stars Canvas */}
          <canvas ref={ramadanCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />

          {/* Sol Altta Zarif Cami Silüeti & Gece Atmosferi (Watermark Backdrop) */}
          <div 
            className="ramadan-mosque-backdrop"
            style={{
              backgroundImage: `url(${ramadanMosqueImg})`,
            }}
          />

          {/* Floating Subtle Amber Bokeh Orbs */}
          <div className="ramadan-bokeh-container">
            <div className="ramadan-bokeh rb-1" />
            <div className="ramadan-bokeh rb-2" />
            <div className="ramadan-bokeh rb-3" />
          </div>

          {/* 🌙 HANGING GOLDEN CRESCENT & OTTOMAN KANDILS (TOP SIDES DISTRIBUTED) */}
          <div className="ramadan-hanging-wrapper">
            <svg width="0" height="0" style={{ position: 'absolute' }}>
              <defs>
                <linearGradient id="ramadanGoldMetal" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#fffbeb" />
                  <stop offset="30%" stopColor="#fef08a" />
                  <stop offset="65%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#b45309" />
                </linearGradient>
                <linearGradient id="kandilFlameGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="35%" stopColor="#f97316" />
                  <stop offset="70%" stopColor="#fde047" />
                  <stop offset="100%" stopColor="#ffffff" />
                </linearGradient>
                <radialGradient id="kandilGlassGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#fef08a" stopOpacity="0.95" />
                  <stop offset="50%" stopColor="#f59e0b" stopOpacity="0.6" />
                  <stop offset="100%" stopColor="#d97706" stopOpacity="0.1" />
                </radialGradient>
                <filter id="kandilGlowFilter" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="moonGlowFilter" x="-30%" y="-30%" width="160%" height="160%">
                  <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#f59e0b" floodOpacity="0.6" />
                </filter>
              </defs>
            </svg>

            {/* ── LEFT CLUSTER (SIDE BY SIDE) ── */}
            {/* 1. Hanging Golden Crescent Moon & Star (Hilal) */}
            <div className="hanging-ramadan-item sway-ramadan-1 ramadan-item-left-1" style={{ left: '16px' }}>
              <div className="gold-chain-wire" style={{ height: '115px' }} />
              <svg viewBox="0 0 48 54" width="42" height="48" filter="url(#moonGlowFilter)">
                {/* Ring Top */}
                <circle cx="24" cy="4" r="3" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.8" />
                {/* Crescent Moon */}
                <path 
                  d="M 24 8 A 19 19 0 1 0 42 35 A 15 15 0 1 1 24 8 Z" 
                  fill="url(#ramadanGoldMetal)" 
                />
                {/* Inner Hanging Star */}
                <polygon 
                  points="31,22 33,26 37,27 34,30 35,34 31,32 27,34 28,30 25,27 29,26" 
                  fill="#ffffff" 
                />
              </svg>
            </div>

            {/* 2. Hanging Ottoman Kandil Lantern (Kandil) */}
            <div className="hanging-ramadan-item sway-ramadan-2 ramadan-item-left-2" style={{ left: '68px' }}>
              <div className="gold-chain-wire" style={{ height: '85px' }} />
              <svg viewBox="0 0 40 58" width="36" height="52" filter="url(#kandilGlowFilter)">
                {/* Top Ring & Dome */}
                <circle cx="20" cy="4" r="3" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.8" />
                <path d="M 12 12 Q 20 6 28 12 L 26 18 L 14 18 Z" fill="url(#ramadanGoldMetal)" />
                {/* Glass Chamber with Glowing Candle */}
                <polygon points="13,18 27,18 29,42 11,42" fill="url(#kandilGlassGlow)" stroke="url(#ramadanGoldMetal)" strokeWidth="1.5" />
                {/* Intricate Filigree Grid */}
                <line x1="20" y1="18" x2="20" y2="42" stroke="url(#ramadanGoldMetal)" strokeWidth="1.2" />
                <line x1="12" y1="30" x2="28" y2="30" stroke="url(#ramadanGoldMetal)" strokeWidth="1.2" />
                {/* Candle Flame (Flickering) */}
                <ellipse cx="20" cy="30" rx="3.5" ry="6" fill="url(#kandilFlameGrad)" className="kandil-flame-flicker" />
                {/* Bottom Base & Droplet */}
                <polygon points="11,42 29,42 24,48 16,48" fill="url(#ramadanGoldMetal)" />
                <circle cx="20" cy="52" r="2.5" fill="url(#ramadanGoldMetal)" />
              </svg>
            </div>

            {/* 3. Hanging 8-point Seljuk Star Pendant */}
            <div className="hanging-ramadan-item sway-ramadan-3 ramadan-desktop-only" style={{ left: '120px' }}>
              <div className="gold-chain-wire" style={{ height: '140px' }} />
              <svg viewBox="0 0 34 38" width="28" height="32" filter="url(#moonGlowFilter)">
                <circle cx="17" cy="3" r="2.5" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.5" />
                <polygon points="17,8 20,13 25,10 23,16 28,19 22,21 23,27 18,24 16,30 14,24 9,27 10,21 4,19 9,16 7,10 12,13" fill="url(#ramadanGoldMetal)" />
                <circle cx="17" cy="18.5" r="3" fill="#ffffff" />
              </svg>
            </div>

            {/* ── RIGHT CLUSTER (SIDE BY SIDE) ── */}
            {/* 4. Hanging Ottoman Kandil Lantern (Right 3) */}
            <div className="hanging-ramadan-item sway-ramadan-4 ramadan-desktop-only" style={{ right: '120px' }}>
              <div className="gold-chain-wire" style={{ height: '135px' }} />
              <svg viewBox="0 0 36 54" width="32" height="48" filter="url(#kandilGlowFilter)">
                <circle cx="18" cy="3" r="2.5" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.5" />
                <path d="M 10 10 Q 18 5 26 10 L 24 15 L 12 15 Z" fill="url(#ramadanGoldMetal)" />
                <polygon points="11,15 25,15 27,38 9,38" fill="url(#kandilGlassGlow)" stroke="url(#ramadanGoldMetal)" strokeWidth="1.5" />
                <ellipse cx="18" cy="27" rx="3" ry="5.5" fill="url(#kandilFlameGrad)" className="kandil-flame-flicker" />
                <polygon points="9,38 27,38 22,44 14,44" fill="url(#ramadanGoldMetal)" />
                <circle cx="18" cy="48" r="2" fill="url(#ramadanGoldMetal)" />
              </svg>
            </div>

            {/* 5. Hanging Ottoman Kandil Lantern (Right 2) */}
            <div className="hanging-ramadan-item sway-ramadan-2 ramadan-item-right-2" style={{ right: '68px' }}>
              <div className="gold-chain-wire" style={{ height: '90px' }} />
              <svg viewBox="0 0 40 58" width="36" height="52" filter="url(#kandilGlowFilter)">
                <circle cx="20" cy="4" r="3" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.8" />
                <path d="M 12 12 Q 20 6 28 12 L 26 18 L 14 18 Z" fill="url(#ramadanGoldMetal)" />
                <polygon points="13,18 27,18 29,42 11,42" fill="url(#kandilGlassGlow)" stroke="url(#ramadanGoldMetal)" strokeWidth="1.5" />
                <line x1="20" y1="18" x2="20" y2="42" stroke="url(#ramadanGoldMetal)" strokeWidth="1.2" />
                <line x1="12" y1="30" x2="28" y2="30" stroke="url(#ramadanGoldMetal)" strokeWidth="1.2" />
                <ellipse cx="20" cy="30" rx="3.5" ry="6" fill="url(#kandilFlameGrad)" className="kandil-flame-flicker" />
                <polygon points="11,42 29,42 24,48 16,48" fill="url(#ramadanGoldMetal)" />
                <circle cx="20" cy="52" r="2.5" fill="url(#ramadanGoldMetal)" />
              </svg>
            </div>

            {/* 6. Hanging Golden Crescent Moon & Star (Right 1) */}
            <div className="hanging-ramadan-item sway-ramadan-1 ramadan-item-right-1" style={{ right: '16px' }}>
              <div className="gold-chain-wire" style={{ height: '120px' }} />
              <svg viewBox="0 0 48 54" width="42" height="48" filter="url(#moonGlowFilter)">
                <circle cx="24" cy="4" r="3" fill="none" stroke="url(#ramadanGoldMetal)" strokeWidth="1.8" />
                <path 
                  d="M 24 8 A 19 19 0 1 0 42 35 A 15 15 0 1 1 24 8 Z" 
                  fill="url(#ramadanGoldMetal)" 
                />
                <polygon 
                  points="31,22 33,26 37,27 34,30 35,34 31,32 27,34 28,30 25,27 29,26" 
                  fill="#ffffff" 
                />
              </svg>
            </div>
          </div>

          <style>{`
            .ramadan-mosque-backdrop {
              position: absolute;
              bottom: 0;
              left: 0;
              width: min(600px, 46vw);
              height: min(440px, 50vh);
              background-size: cover;
              background-position: bottom center;
              background-repeat: no-repeat;
              pointer-events: none;
              user-select: none;
              z-index: 9989;
              opacity: 0.35;
              mask-image: linear-gradient(to top, rgba(0, 0, 0, 1) 30%, transparent 100%), linear-gradient(to right, rgba(0, 0, 0, 1) 45%, transparent 100%);
              -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 1) 30%, transparent 100%), linear-gradient(to right, rgba(0, 0, 0, 1) 45%, transparent 100%);
              -webkit-mask-composite: source-in;
              mask-composite: intersect;
              filter: drop-shadow(0 -10px 30px rgba(0, 0, 0, 0.8));
              transition: opacity 0.3s ease;
            }

            .ramadan-hanging-wrapper {
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 240px;
              pointer-events: none;
              user-select: none;
              z-index: 9993;
            }
            .hanging-ramadan-item {
              position: absolute;
              top: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              transform-origin: top center;
            }
            .gold-chain-wire {
              width: 1.5px;
              background: linear-gradient(to bottom, #fffbeb, #fef08a, #f59e0b, #d97706);
              box-shadow: 0 0 4px rgba(245, 158, 11, 0.6);
            }

            @keyframes ramadanPendulum1 {
              0% { transform: rotate(-4.5deg); }
              50% { transform: rotate(3.5deg); }
              100% { transform: rotate(-4.5deg); }
            }
            @keyframes ramadanPendulum2 {
              0% { transform: rotate(4deg); }
              50% { transform: rotate(-3.5deg); }
              100% { transform: rotate(4deg); }
            }
            .sway-ramadan-1 { animation: ramadanPendulum1 5.8s ease-in-out infinite; }
            .sway-ramadan-2 { animation: ramadanPendulum2 6.5s ease-in-out infinite 0.4s; }
            .sway-ramadan-3 { animation: ramadanPendulum1 7.2s ease-in-out infinite 0.8s; }
            .sway-ramadan-4 { animation: ramadanPendulum2 6s ease-in-out infinite 0.2s; }

            .kandil-flame-flicker {
              animation: kandilFlicker 1.8s ease-in-out infinite alternate;
              transform-origin: center;
            }
            @keyframes kandilFlicker {
              0% { opacity: 0.8; transform: scale(0.95); }
              50% { opacity: 1; transform: scale(1.08); }
              100% { opacity: 0.85; transform: scale(0.98); }
            }

            .ramadan-bokeh-container {
              position: absolute;
              inset: 0;
              pointer-events: none;
              overflow: hidden;
            }
            .ramadan-bokeh {
              position: absolute;
              border-radius: 50%;
              background: radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.04) 50%, transparent 75%);
              filter: blur(16px);
              animation: ramadanBokehFloat 10s ease-in-out infinite alternate;
            }
            .rb-1 { width: 180px; height: 180px; top: 15%; right: 20%; animation-duration: 11s; }
            .rb-2 { width: 140px; height: 140px; top: 40%; left: 25%; animation-duration: 9s; }
            .rb-3 { width: 120px; height: 120px; bottom: 20%; right: 30%; animation-duration: 13s; }
            @keyframes ramadanBokehFloat {
              0% { transform: translate(0, 0) scale(1); opacity: 0.35; }
              100% { transform: translate(25px, -20px) scale(1.2); opacity: 0.7; }
            }

            @media (max-width: 768px) {
              .ramadan-mosque-backdrop {
                width: 240px;
                height: 180px;
                opacity: 0.2;
              }
              .ramadan-desktop-only {
                display: none !important;
              }
              .ramadan-item-left-1 { left: 8px !important; transform: scale(0.82); transform-origin: top center; }
              .ramadan-item-left-2 { left: 45px !important; transform: scale(0.82); transform-origin: top center; }
              .ramadan-item-right-1 { right: 8px !important; transform: scale(0.82); transform-origin: top center; }
              .ramadan-item-right-2 { right: 45px !important; transform: scale(0.82); transform-origin: top center; }
            }
          `}</style>
        </div>
      )}

      {/* ── 🌌 1. AURORA BOREALIS (KUZEY IŞIKLARI) ── */}
      {theme === 'aurora' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img aurora-backdrop" 
              style={{ backgroundImage: `url(${auroraNightImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            <canvas ref={auroraCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* Hanging Ice & Star Crystals */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
                <div className="decor-chain" style={{ height: '90px', background: 'linear-gradient(to bottom, #a78bfa, #6ee7b7)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #10b981)' }}>❄️</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '75px' }}>
                <div className="decor-chain" style={{ height: '120px', background: 'linear-gradient(to bottom, #6ee7b7, #8b5cf6)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #8b5cf6)' }}>✨</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '20px' }}>
                <div className="decor-chain" style={{ height: '100px', background: 'linear-gradient(to bottom, #a78bfa, #6ee7b7)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #06b6d4)' }}>❄️</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '75px' }}>
                <div className="decor-chain" style={{ height: '130px', background: 'linear-gradient(to bottom, #6ee7b7, #8b5cf6)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #10b981)' }}>🌌</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 🌧️ 2. YAĞMURLU ESKİŞEHİR (PORSUK GECESİ) ── */}
      {theme === 'rainy_eskisehir' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img eskisehir-backdrop" 
              style={{ backgroundImage: `url(${eskisehirPorsukImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            <canvas ref={rainCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* Hanging Vintage Streetlamps / Umbrellas */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
                <div className="decor-chain" style={{ height: '85px', background: 'linear-gradient(to bottom, #fde68a, #f59e0b)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #f59e0b)' }}>🏮</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '70px' }}>
                <div className="decor-chain" style={{ height: '115px', background: 'linear-gradient(to bottom, #bae6fd, #38bdf8)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #38bdf8)' }}>☔</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '20px' }}>
                <div className="decor-chain" style={{ height: '90px', background: 'linear-gradient(to bottom, #fde68a, #f59e0b)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #f59e0b)' }}>🏮</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '70px' }}>
                <div className="decor-chain" style={{ height: '120px', background: 'linear-gradient(to bottom, #bae6fd, #38bdf8)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #38bdf8)' }}>💧</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ⚔️ 3. ANTİK MISIR & ÇÖL ALTINI (DUNE) ── */}
      {theme === 'desert_gold' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img egypt-backdrop" 
              style={{ backgroundImage: `url(${egyptPyramidsImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            <canvas ref={desertCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* Hanging Golden Ankh & Amulets */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
                <div className="decor-chain" style={{ height: '110px', background: 'linear-gradient(to bottom, #fef08a, #eab308, #b45309)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #eab308)' }}>👑</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '75px' }}>
                <div className="decor-chain" style={{ height: '80px', background: 'linear-gradient(to bottom, #fef08a, #eab308)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #facc15)' }}>✨</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '20px' }}>
                <div className="decor-chain" style={{ height: '115px', background: 'linear-gradient(to bottom, #fef08a, #eab308, #b45309)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 12px #eab308)' }}>☥</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '75px' }}>
                <div className="decor-chain" style={{ height: '85px', background: 'linear-gradient(to bottom, #fef08a, #eab308)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #facc15)' }}>🏺</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── ☕ 4. KAHVE & AHŞAP BARISTA (COZY COFFEE) ── */}
      {theme === 'cozy_coffee' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img coffee-backdrop" 
              style={{ backgroundImage: `url(${cozyCoffeeImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            <canvas ref={coffeeCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* Hanging Vintage Coffee Charms */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
                <div className="decor-chain" style={{ height: '95px', background: 'linear-gradient(to bottom, #fde68a, #d97706)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #d97706)' }}>☕</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '75px' }}>
                <div className="decor-chain" style={{ height: '125px', background: 'linear-gradient(to bottom, #fef3c7, #b45309)' }} />
                <span style={{ fontSize: '20px', filter: 'drop-shadow(0 0 6px #b45309)' }}>🤎</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '20px' }}>
                <div className="decor-chain" style={{ height: '100px', background: 'linear-gradient(to bottom, #fde68a, #d97706)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #d97706)' }}>☕</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '75px' }}>
                <div className="decor-chain" style={{ height: '130px', background: 'linear-gradient(to bottom, #fef3c7, #b45309)' }} />
                <span style={{ fontSize: '20px', filter: 'drop-shadow(0 0 6px #b45309)' }}>🥐</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 🎮 5. RETRO ARCADE & 8-BIT NOSTALJİ ── */}
      {theme === 'retro_arcade' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img arcade-backdrop" 
              style={{ backgroundImage: `url(${retroArcadeImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            <canvas ref={arcadeCanvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
            {/* Hanging 8-Bit Pixel Game Charms */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '20px' }}>
                <div className="decor-chain" style={{ height: '90px', background: 'linear-gradient(to bottom, #86efac, #22c55e)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #22c55e)' }}>🕹️</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '75px' }}>
                <div className="decor-chain" style={{ height: '120px', background: 'linear-gradient(to bottom, #fde047, #eab308)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #facc15)' }}>⭐</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '20px' }}>
                <div className="decor-chain" style={{ height: '95px', background: 'linear-gradient(to bottom, #fb7185, #f43f5e)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #f43f5e)' }}>👾</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '75px' }}>
                <div className="decor-chain" style={{ height: '125px', background: 'linear-gradient(to bottom, #86efac, #22c55e)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #22c55e)' }}>🎮</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── 🎖️ 16. ASKERİ & TAKTİK OPERASYON (MILITARY) ── */}
      {theme === 'military' && effectsEnabled && (
        <>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9989, overflow: 'hidden' }}>
            <div 
              className="theme-backdrop-img military-backdrop" 
              style={{ backgroundImage: `url(${militaryTacticalImg})` }} 
            />
          </div>
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9990, overflow: 'hidden' }}>
            {/* Tactical Radar HUD overlay in top-right corner */}
            <div className="military-radar-hud">
              <div className="military-radar-circle">
                <div className="military-radar-sweep" />
                <div className="military-blip blip-1" />
                <div className="military-blip blip-2" />
                <div className="military-blip blip-3" />
                <div className="military-crosshair-h" />
                <div className="military-crosshair-v" />
              </div>
              <div className="military-hud-telemetry">
                <div className="telemetry-line"><span className="telemetry-tag">DEF-CON:</span> <span className="telemetry-val">1 [ACTIVE]</span></div>
                <div className="telemetry-line"><span className="telemetry-tag">SAT-COM:</span> <span className="telemetry-val">LINKED 99.8%</span></div>
                <div className="telemetry-line"><span className="telemetry-tag">GRID:</span> <span className="telemetry-val">39°46'N 30°31'E</span></div>
              </div>
            </div>

            {/* Tactical Badges & Dog Tags */}
            <div className="theme-hanging-bar">
              <div className="hanging-decor sway-decor-1" style={{ left: '25px' }}>
                <div className="decor-chain" style={{ height: '90px', background: 'linear-gradient(to bottom, #d9f99d, #65a30d)' }} />
                <span style={{ fontSize: '26px', filter: 'drop-shadow(0 0 10px #84cc16)' }}>🎖️</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ left: '85px' }}>
                <div className="decor-chain" style={{ height: '120px', background: 'linear-gradient(to bottom, #fde047, #ca8a04)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #eab308)' }}>🛡️</span>
              </div>
              <div className="hanging-decor sway-decor-1" style={{ right: '25px' }}>
                <div className="decor-chain" style={{ height: '95px', background: 'linear-gradient(to bottom, #d9f99d, #4d7c0f)' }} />
                <span style={{ fontSize: '24px', filter: 'drop-shadow(0 0 10px #84cc16)' }}>🎯</span>
              </div>
              <div className="hanging-decor sway-decor-2" style={{ right: '85px' }}>
                <div className="decor-chain" style={{ height: '125px', background: 'linear-gradient(to bottom, #d9f99d, #65a30d)' }} />
                <span style={{ fontSize: '22px', filter: 'drop-shadow(0 0 8px #65a30d)' }}>📻</span>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Global CSS for Shared Backdrop & Hanging Elements */}
      <style>{`
        /* Military Radar HUD Styles */
        .military-radar-hud {
          position: fixed;
          top: 60px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 14px;
          background: rgba(9, 14, 9, 0.85);
          border: 1px solid rgba(132, 204, 22, 0.45);
          border-radius: 8px;
          box-shadow: 0 0 20px rgba(132, 204, 22, 0.18);
          backdrop-filter: blur(8px);
          pointer-events: none;
          z-index: 9991;
        }
        .military-radar-circle {
          position: relative;
          width: 52px;
          height: 52px;
          border-radius: 50%;
          border: 1px solid rgba(132, 204, 22, 0.6);
          background: radial-gradient(circle, rgba(132, 204, 22, 0.15) 0%, rgba(9, 14, 9, 0.9) 70%);
          overflow: hidden;
          box-shadow: inset 0 0 10px rgba(132, 204, 22, 0.3);
        }
        .military-radar-sweep {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          background: conic-gradient(from 0deg, rgba(132, 204, 22, 0.6) 0deg, transparent 65deg, transparent 360deg);
          animation: radarSweep 3.5s linear infinite;
        }
        .military-crosshair-h {
          position: absolute;
          top: 50%;
          left: 0;
          right: 0;
          height: 1px;
          background: rgba(132, 204, 22, 0.4);
        }
        .military-crosshair-v {
          position: absolute;
          left: 50%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(132, 204, 22, 0.4);
        }
        .military-blip {
          position: absolute;
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #bef264;
          box-shadow: 0 0 6px #84cc16;
          animation: blipBlink 2.2s ease-in-out infinite;
        }
        .blip-1 { top: 14px; left: 32px; animation-delay: 0.2s; }
        .blip-2 { top: 34px; left: 16px; animation-delay: 1.1s; }
        .blip-3 { top: 22px; left: 24px; animation-delay: 1.8s; }
        @keyframes radarSweep {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes blipBlink {
          0%, 100% { opacity: 0.25; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        .military-hud-telemetry {
          display: flex;
          flex-direction: column;
          gap: 2px;
          font-family: monospace;
          font-size: 10px;
          letter-spacing: 0.5px;
        }
        .telemetry-tag {
          color: #84cc16;
          font-weight: 700;
        }
        .telemetry-val {
          color: #bbf7d0;
        }
        @media (max-width: 900px) {
          .military-radar-hud {
            display: none;
          }
        }

        .theme-backdrop-img {
          position: fixed;
          bottom: 0;
          left: 0;
          width: min(650px, 50vw);
          height: min(480px, 55vh);
          background-size: cover;
          background-position: bottom center;
          background-repeat: no-repeat;
          pointer-events: none;
          user-select: none;
          z-index: 9989;
          opacity: 0.42;
          mask-image: linear-gradient(to top, rgba(0, 0, 0, 1) 35%, transparent 100%), linear-gradient(to right, rgba(0, 0, 0, 1) 45%, transparent 100%);
          -webkit-mask-image: linear-gradient(to top, rgba(0, 0, 0, 1) 35%, transparent 100%), linear-gradient(to right, rgba(0, 0, 0, 1) 45%, transparent 100%);
          -webkit-mask-composite: source-in;
          mask-composite: intersect;
          filter: drop-shadow(0 -10px 30px rgba(0, 0, 0, 0.8));
          transition: opacity 0.3s ease;
        }

        .theme-hanging-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 200px;
          pointer-events: none;
          user-select: none;
          z-index: 9993;
        }

        .hanging-decor {
          position: absolute;
          top: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          transform-origin: top center;
          width: auto !important;
        }

        .decor-chain {
          width: 2px !important;
          box-shadow: 0 0 4px rgba(255, 255, 255, 0.4);
        }

        @keyframes themeSway1 {
          0% { transform: rotate(-5deg); }
          50% { transform: rotate(4deg); }
          100% { transform: rotate(-5deg); }
        }
        @keyframes themeSway2 {
          0% { transform: rotate(4.5deg); }
          50% { transform: rotate(-4deg); }
          100% { transform: rotate(4.5deg); }
        }
        .sway-decor-1 { animation: themeSway1 6s ease-in-out infinite; }
        .sway-decor-2 { animation: themeSway2 6.8s ease-in-out infinite 0.5s; }

        @media (max-width: 768px) {
          .theme-backdrop-img {
            width: 260px;
            height: 200px;
            opacity: 0.3;
          }
          .hanging-decor {
            transform: scale(0.8);
            transform-origin: top center;
          }
        }
      `}</style>
    </>
  );
}
