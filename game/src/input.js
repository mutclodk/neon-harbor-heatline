// Keyboard and mouse input handling for player movement, driving, combat, and menus.

export function createInput(canvas) {
  const keys = new Set();
  let interactJustPressed = false;
  let pauseJustPressed = false;
  let fireJustPressed = false;
  let lookDeltaX = 0;
  let lookDeltaY = 0;
  let isPointerLocked = false;

  function onKeyDown(e) {
    keys.add(e.code);

    if (e.code === 'KeyE') interactJustPressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') pauseJustPressed = true;
    if (e.code === 'Space' || e.code === 'KeyF') fireJustPressed = true;
  }

  function onKeyUp(e) {
    keys.delete(e.code);
  }

  function onMouseMove(e) {
    if (isPointerLocked || e.buttons === 1 || e.buttons === 2) {
      lookDeltaX += e.movementX || 0;
      lookDeltaY += e.movementY || 0;
    }
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      fireJustPressed = true;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mousedown', onMouseDown);

  function poll() {
    let moveX = 0;
    let moveY = 0;

    if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) moveY += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) moveY -= 1;

    const sprint = keys.has('ShiftLeft') || keys.has('ShiftRight');
    const handbrake = keys.has('Space');

    const frame = {
      moveX,
      moveY,
      throttle: moveY,
      steer: moveX,
      sprint,
      handbrake,
      interactJustPressed,
      pauseJustPressed,
      fireJustPressed,
      lookX: lookDeltaX,
      lookY: lookDeltaY,
    };

    // Reset single-frame triggers
    interactJustPressed = false;
    pauseJustPressed = false;
    fireJustPressed = false;
    lookDeltaX = 0;
    lookDeltaY = 0;

    return frame;
  }

  return { poll };
}
