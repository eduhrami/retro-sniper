# 🎯 RETRO SNIPER — Cazador Oculto

Juego arcade retro de **francotirador en primera persona** para navegador. Sin dependencias, sin build: HTML + CSS + Canvas 2D puro con estética CRT (scanlines, fósforo verde, pixel-art).

Eres un francotirador. Los enemigos están **MUY bien camuflados** en el paisaje: apenas se ven, solo siluetas... hasta que **se mueven**. Observa, apunta con la mira y dispara con precisión antes de que se acabe el tiempo o la munición.

## 🎮 Cómo jugar

| Acción | Control |
|---|---|
| Apuntar | Mover el ratón |
| Disparar | Clic izquierdo |
| Zoom de mira | Mantener **clic derecho** o **ESPACIO** |
| **Cubrirse / agacharse** | Mantener **SHIFT** (o el botón ▼ CUBRIRSE) |
| Móvil | Arrastrar para apuntar · soltar para disparar · dos dedos = zoom · botón para cubrirse |

### Reglas
- **Munición limitada** (un poco más balas que enemigos). Cada disparo cuenta.
- Un **enemigo eliminado** = objetivo menos. Despeja la zona para pasar de nivel.
- ❤️ Tienes **5 puntos de vida**. Si llegan a 0, misión fallida.
- ☠️ **Los enemigos también disparan**: a veces uno **te apunta** — verás un destello rojo y el aviso *«¡TE APUNTAN!»*. Tienes ~1 segundo para reaccionar. Al apuntar **se exponen**, así que es tu oportunidad de dispararle primero.
- 🏃 **Los enemigos se reubican:** cada ~30 s (y a veces justo después de dispararte) **corren a un nuevo escondite**. Mientras corren quedan **totalmente al descubierto** — el mejor momento para abatirlos. Al morir sueltan un **grito**; los animales/inocentes, un chillido.
- ▼ **Agáchate (SHIFT)** para esquivar sus balas. Mientras estás cubierto **no puedes disparar**, pero **ninguna bala te da**.
- 🪤 **Señuelos:** siluetas falsas. Se balancean pero **nunca se asoman con movimiento brusco**. Dispararles gasta una bala.
- 🦌 **Fauna / inocentes:** animales y transeúntes que cruzan la escena. Si le disparas a uno por error, **lo ves morir** y pierdes **1 bala y 1 punto de vida**. ¡Disciplina de gatillo!
- ⏳ Se pierde el nivel si se acaba el **tiempo**, la **munición** con objetivos vivos, o tu **vida**.

### 💡 Truco
La clave es el **movimiento**. Un enemigo real "se asoma" cada pocos segundos (una parte del cuerpo aparece y su silueta gana contraste). Los señuelos no hacen eso. Usa el **zoom** para inspeccionar coberturas sospechosas: cactus, edificios, árboles y arbustos.

## 🗺️ Niveles (9 biomas)
1. **Desierto** 🌵 — 3 objetivos · 14 balas · 60 s
2. **Playa** 🏖️ — 3 objetivos · 14 balas · 58 s
3. **Ciudad** 🏙️ — 4 objetivos · 15 balas · 56 s
4. **Castillos** 🏰 — 4 objetivos · 15 balas · 56 s
5. **Bosque** 🌲 — 5 objetivos · 16 balas · 54 s
6. **Casa abandonada** 🏚️ (¡estás dentro!) — 5 objetivos · 16 balas · 54 s
7. **Bajo el mar** 🌊 — 5 objetivos · 16 balas · 54 s
8. **Hielo** ❄️ — 6 objetivos · 17 balas · 52 s
9. **Espacio exterior** 🚀 — 7 objetivos · 18 balas · 50 s

Cada bioma tiene su propio paisaje, coberturas donde esconderse (cactus, palmeras, edificios, torres y almenas, árboles, muebles rotos, corales, bloques de hielo, cristales alienígenas…) y su propia fauna que cruza la escena (aves, cangrejos, cuervos, caballeros, ratas, murciélagos, peces, pingüinos, ovnis, etc.). La **casa abandonada** se juega **desde el interior**: pared con ventanas y luz de luna, telarañas y suelo de tablones.

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
