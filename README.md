# 🎯 RETRO SNIPER — Cazador Oculto

Juego arcade retro de **francotirador en primera persona** para navegador. Sin dependencias, sin build: HTML + CSS + Canvas 2D puro con estética CRT (scanlines, fósforo verde, pixel-art).

Eres un francotirador. Los enemigos están **MUY bien camuflados** en el paisaje: apenas se ven, solo siluetas... hasta que **se mueven**. Observa, apunta con la mira y dispara con precisión antes de que se acabe el tiempo o la munición.

## 🎮 Cómo jugar

| Acción | Control |
|---|---|
| Apuntar | Mover el ratón |
| Disparar | Clic izquierdo |
| Zoom de mira | Mantener **clic derecho** o **ESPACIO** |
| Móvil | Arrastrar para apuntar · soltar para disparar · dos dedos = zoom |

### Reglas
- **Munición limitada** (un poco más balas que enemigos). Cada disparo cuenta.
- Un **enemigo eliminado** = objetivo menos. Despeja la zona para pasar de nivel.
- 🪤 **Señuelos:** siluetas falsas plantadas por el enemigo. Se balancean pero **nunca se asoman con movimiento brusco**. Dispararles gasta una bala.
- 🦌 **Fauna / paseantes:** animales y transeúntes visibles que cruzan la escena. **No les dispares**: gastan bala.
- ⏳ Se pierde el nivel si se acaba el **tiempo** o la **munición** con objetivos vivos.

### 💡 Truco
La clave es el **movimiento**. Un enemigo real "se asoma" cada pocos segundos (una parte del cuerpo aparece y su silueta gana contraste). Los señuelos no hacen eso. Usa el **zoom** para inspeccionar coberturas sospechosas: cactus, edificios, árboles y arbustos.

## 🗺️ Niveles
1. **Desierto** — 3 objetivos · 6 balas · 60 s
2. **Ciudad** — 4 objetivos · 6 balas · 56 s
3. **Bosque** — 5 objetivos · 7 balas · 54 s

## ▶️ Ejecutar
Solo abre `index.html` en un navegador. En WSL:

```bash
wslview index.html
```

No requiere servidor ni instalación.

## 🧱 Estructura
- `index.html` — estructura, HUD y overlays
- `style.css` — estética CRT/arcade
- `game.js` — motor del juego (render procedural de biomas, IA de camuflaje, disparo, flujo de niveles, audio WebAudio)

---
Hecho con 🎯 y nostalgia de recreativa.
