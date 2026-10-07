// Illustrative page light. Pointer travel never controls system display settings.
(() => {
  const button = document.querySelector('.pull-switch');
  const scene = document.querySelector('.lamp-scene');
  if (!button || !scene) return;
  let gesture = null;
  const toggle = () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    document.body.dataset.lamp = on ? 'on' : 'off';
  };
  const reset = () => {
    gesture = null;
    scene.classList.remove('pulling');
    scene.style.setProperty('--pull', '0px');
    scene.style.setProperty('--stretch', '1');
  };
  button.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    const width = scene.getBoundingClientRect().width;
    gesture = { id: event.pointerId, y: event.clientY, distance: 0,
      threshold: Math.max(18, width * .055), max: width * .14,
      rope: width * .23 * .66 };
    button.setPointerCapture(event.pointerId);
    scene.classList.add('pulling');
    event.preventDefault();
  });
  button.addEventListener('pointermove', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.distance = Math.max(0, Math.min(gesture.max, event.clientY - gesture.y));
    scene.style.setProperty('--pull', `${gesture.distance}px`);
    scene.style.setProperty('--stretch', String(1 + gesture.distance / gesture.rope));
  });
  button.addEventListener('pointerup', event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const activated = gesture.distance >= gesture.threshold;
    reset();
    if (activated) toggle();
  });
  button.addEventListener('pointercancel', reset);
  button.addEventListener('lostpointercapture', reset);
  button.addEventListener('click', event => {
    if (event.detail === 0) toggle(); // Native Enter/Space or assistive activation.
  });
  window.addEventListener('blur', reset);
})();
