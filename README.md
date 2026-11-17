# Sea Rider

Гидроцикл, остров в духе греческих островов и поиск сокровищ — над водой и под водой.
WebGPU, без движка.

**Играть:** https://andrewforester.github.io/sea-rider/ (нужен браузер с WebGPU: Chrome / Edge 113+, Safari 26+).

## Управление

- **WASD / стрелки** — газ и руль / ходьба / плавание, **мышь** — обзор (клик, чтобы захватить курсор)
- **Shift** — быстрее, **Space** — прыжок
- **F** — сесть на ближайший гидроцикл или спрыгнуть с него
- Нырок и всплытие автоматические: посмотри вниз и плыви — нырнёшь; плыви вверх — вынырнешь. **Q** — нырнуть вручную.

Собери все ⭐ — на пляжах, в деревне, на вершинах, на буйках в море и в подводном мире.

## Разработка

```bash
npm install
npm run build   # собирает game.html
npm start       # http://localhost:8090
```

## Благодарности

Основано на двух проектах Maksymilian Dendura (MIT):
- [web-ocean](https://github.com/Noniv/web-ocean) — FFT-океан (`LICENSE-web-ocean`)
- [abyssal-garden](https://github.com/Noniv/abyssal-garden) — подводный мир (`LICENSE-abyssal-garden`)
