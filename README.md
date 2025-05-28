# 3D Rendering Contest

![Representative Image](assets/representative.png)

Demo : https://sy-hwang.github.io/nubzuki-brainrot/

## How to run locally

1. Open your terminal and move to the project directory.

```bash
cd path/to/your/project
```

2. Start a simple HTTP server using Python:

```bash
python3 -m http.server 8000
```

3. Open your web browser and go to:

```
http://localhost:8000
```

## Features

### Rendered Video Playback
- Click the Play button to follow a predefined camera trajectory
- Click anywhere during playback to stop

### Real-time Interaction
- Model Click: Zooms in and displays an info panel. Jumpable models will perform a jump animation
- Model Drag: Rotate the model
- Background Drag/Wheel: Control the camera
- Auto Rotate Button: Toggle automatic model rotation

### Edit Mode
- Click on a model to select it for editing
- Freely change the position of the 3x enlarged model
- Model Drag: Rotate the selected model
- Shift + Drag: Change selected model position
- When exiting Edit Mode, the model returns to its original size

