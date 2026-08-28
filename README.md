# Math Board

A real-time collaborative math whiteboard built with React, TypeScript, HTML5 Canvas, Yjs, and WebRTC.

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL in two browser windows. Copy the complete URL, including the `#room-...` hash, into both windows; that hash is the room identity. WebRTC collaboration requires `localhost` during local testing or an HTTPS deployment in production.

## Production

```bash
npm run build
npm run preview
```

## Free hosting

The app is a static Vite site. The repository includes `netlify.toml` for one-click Netlify deployment and `render.yaml` for the required WebSocket signaling service.

### Enable real-time collaboration

1. In [dashboard.render.com](https://dashboard.render.com/), choose **New > Blueprint** and select this repository.
2. Deploy the `math-board-signaling` free web service from `render.yaml`.
3. Copy its URL, for example `https://math-board-signaling.onrender.com`.
4. In Netlify, open **Site configuration > Environment variables** and add `VITE_SIGNALING_URL` with the value `wss://math-board-signaling.onrender.com`.
5. Trigger a new Netlify deploy.

Render's free service may sleep when idle; the first connection after inactivity can take a few seconds.

For Netlify:

1. Open [app.netlify.com](https://app.netlify.com/) and sign in with GitHub.
2. Choose **Add new project** and **Import an existing project**.
3. Select `Yaromir-Anokhin/Idroo-clone`.
4. Keep the detected settings: build command `npm run build`, publish directory `dist`.
5. Choose **Deploy**. Netlify will provide a free `*.netlify.app` URL.

For another static host, build manually with:

```bash
npm install
npm run build
```

Publish the `dist` directory. Configure the host to rewrite unknown routes to `index.html`; room state is shared through the URL hash, so no database or server is required.

## Controls

- Use the top toolbar for selection, panning, pen, lines, arrows, 2D shapes, projected 3D cubes, cylinders, cones, erasing, and text labels.
- Choose ink color and stroke width from the bottom toolbar.
- Drag with the Pan tool or middle mouse button to move around the infinite canvas.
- Use the mouse wheel or the zoom controls to zoom around the pointer.
- Select an object and press `Delete` to remove it. Keyboard shortcuts: `V` select, `H` pan, `P` pen, `E` eraser.
- Share the URL from the top-right button. The room identity is the URL hash.

The WebRTC provider uses the Render WebSocket service only for peer discovery. The whiteboard state itself remains peer-to-peer and is not stored on the server.