import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const canvas = document.querySelector('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1d);
scene.fog = new THREE.FogExp2(0x0a0f1d, 0.002);

const camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.1, 2000);

// Lights
const ambient = new THREE.AmbientLight(0xddeeff, 1.2);
scene.add(ambient);

const sun = new THREE.DirectionalLight(0x00f0ff, 2.0);
sun.position.set(150, 300, 100);
sun.castShadow = true;
scene.add(sun);

// Zero City Map Generation (Grid City)
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(2000, 2000),
  new THREE.MeshStandardMaterial({ color: 0x080c16, roughness: 0.9 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// City Buildings
const buildingGroup = new THREE.Group();
const colors = [0x1a233a, 0x0f172a, 0x1e293b, 0x111827];
for (let x = -400; x <= 400; x += 80) {
  for (let z = -400; z <= 400; z += 80) {
    if (Math.abs(x) < 40 && Math.abs(z) < 40) continue; // Spawn area clear
    if (Math.random() > 0.3) {
      const h = 20 + Math.random() * 80;
      const w = 30 + Math.random() * 20;
      const d = 30 + Math.random() * 20;
      const mat = new THREE.MeshStandardMaterial({
        color: colors[Math.floor(Math.random() * colors.length)],
        roughness: 0.3,
        metalness: 0.8
      });
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x + (Math.random() - 0.5) * 10, h / 2, z + (Math.random() - 0.5) * 10);
      b.castShadow = true;
      b.receiveShadow = true;
      buildingGroup.add(b);
    }
  }
}
scene.add(buildingGroup);

// Car Model
const car = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x00f0ff, metalness: 0.6, roughness: 0.2 });
const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.6, 4.2), bodyMat);
body.position.y = 0.5;
body.castShadow = true;
car.add(body);

const cabin = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 0.5, 2.0),
  new THREE.MeshStandardMaterial({ color: 0x050811, metalness: 0.9, roughness: 0.1 })
);
cabin.position.set(0, 0.95, -0.2);
car.add(cabin);

const wheels = [];
const frontWheels = [];
const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
for (const x of [-1.0, 1.0]) {
  for (const z of [-1.3, 1.3]) {
    const wg = new THREE.Group();
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.3, 16), wheelMat);
    w.rotation.z = Math.PI / 2;
    wg.add(w);
    wg.position.set(x, 0.38, z);
    car.add(wg);
    wheels.push(w);
    if (z < 0) frontWheels.push(wg);
  }
}
scene.add(car);

// Controls State
const inputs = { gas: false, brake: false, left: false, right: false, handbrake: false };

window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') inputs.gas = true;
  if (k === 's' || k === 'arrowdown') inputs.brake = true;
  if (k === 'a' || k === 'arrowleft') inputs.left = true;
  if (k === 'd' || k === 'arrowright') inputs.right = true;
  if (k === ' ') inputs.handbrake = true;
  if (k === 'r') resetCar();
  if (k === 'c') cameraMode = (cameraMode + 1) % 2;
});

window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') inputs.gas = false;
  if (k === 's' || k === 'arrowdown') inputs.brake = false;
  if (k === 'a' || k === 'arrowleft') inputs.left = false;
  if (k === 'd' || k === 'arrowright') inputs.right = false;
  if (k === ' ') inputs.handbrake = false;
});

// Touch Events
const bindTouch = (id, key) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('touchstart', e => { e.preventDefault(); inputs[key] = true; });
  el.addEventListener('touchend', e => { e.preventDefault(); inputs[key] = false; });
  el.addEventListener('mousedown', () => inputs[key] = true);
  el.addEventListener('mouseup', () => inputs[key] = false);
};
bindTouch('btn-gas', 'gas');
bindTouch('btn-brake', 'brake');
bindTouch('btn-left', 'left');
bindTouch('btn-right', 'right');
bindTouch('btn-handbrake', 'handbrake');

// Physics & Loop
let speed = 0, steer = 0, heading = 0, driftScore = 0, cameraMode = 0;
function resetCar() {
  speed = 0;
  steer = 0;
  car.position.set(0, 0, 0);
  heading = 0;
  car.rotation.set(0, 0, 0);
}

const speedEl = document.querySelector('#speed');
const gearEl = document.querySelector('#gear');
const scoreEl = document.querySelector('#score');

const clock = new THREE.Clock();
function update() {
  requestAnimationFrame(update);
  const dt = Math.min(clock.getDelta(), 0.033);

  if (inputs.gas) speed += 24 * dt;
  else speed -= 6 * dt;
  if (inputs.brake) speed -= (speed > 0 ? 35 : 12) * dt;

  speed = Math.max(-12, Math.min(75, speed));

  const steerTarget = (inputs.left ? 1 : 0) + (inputs.right ? -1 : 0);
  steer += (steerTarget - steer) * Math.min(1, 8 * dt);

  heading += steer * (0.3 + Math.abs(speed) / 40) * dt * (speed >= 0 ? 1 : -1);
  car.rotation.y = heading;

  frontWheels.forEach(w => w.rotation.y = steer * 0.4);
  wheels.forEach(w => w.rotation.x += (speed / 0.38) * dt);

  const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
  car.position.addScaledVector(forward, speed * dt);

  if (inputs.handbrake && Math.abs(speed) > 15 && Math.abs(steer) > 0.2) {
    driftScore += Math.round(Math.abs(speed * steer));
    scoreEl.textContent = driftScore;
  }

  speedEl.textContent = Math.round(Math.abs(speed) * 3.6);
  gearEl.textContent = speed < -0.5 ? 'R' : speed < 1 ? 'N' : String(Math.min(6, Math.max(1, Math.ceil(speed / 12))));

  // Camera
  const camDist = cameraMode === 0 ? -9 : -16;
  const camHeight = cameraMode === 0 ? 3.5 : 8.0;
  const targetCamPos = car.position.clone().addScaledVector(forward, camDist).add(new THREE.Vector3(0, camHeight, 0));
  camera.position.lerp(targetCamPos, 0.1);
  camera.lookAt(car.position.clone().add(new THREE.Vector3(0, 1, 0)));

  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

update();
