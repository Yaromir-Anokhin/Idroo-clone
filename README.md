# Math Board

A real-time collaborative math whiteboard built with React, TypeScript, HTML5 Canvas, Yjs, and WebRTC.

## Setup

```bash
npm install
npm run dev
```

Open the local Vite URL in two browser windows. The app creates a room hash automatically; sharing that URL joins the same collaborative room.

## Production

```bash
npm run build
npm run preview
```

## Free hosting

The app is a static Vite site. The repository includes `netlify.toml` for one-click Netlify deployment.

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

The WebRTC provider uses browser peer discovery and does not require a separate application server for the whiteboard state.