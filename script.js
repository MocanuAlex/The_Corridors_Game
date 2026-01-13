const GAME_DURATION_SECONDS = 360; 
const ENERGY_MAX = 100;
const ASPECT_RATIO = 1.6; 

let gameActive = false;
let currentTime = 0;
let currentEnergy = 100;
let isDoorClosed = false;
let isVentClosed = false; 
let isPowerOut = false;
let isTabletUp = false;
let isJumpscaring = false;

// Flag-uri atac independente
let isRedAttacking = false; 
let isPurpleAttacking = false; 

const waypoints = 5;
let currentWaypoint = 0; 
let purpleWaypoint = 0;  

let aggressionLevel = 5;
let enemyMoveTimer = null;
let enemyPatienceTimer = null;
let purpleMoveTimer = null;
let purpleAttackTimer = null;

let lightTimer = 0;
let nextFlickerTime = 5; 
let isFlickering = false;

const nodes = [];
for(let i=0; i<waypoints; i++) {
    const el = document.getElementById(`node-${i}`);
    if(el) nodes.push(el);
    else nodes.push(null); 
}

const titleScreen = document.getElementById('title-screen');
const customNightMenu = document.getElementById('custom-night-menu');
const uiLayer = document.getElementById('ui-layer');
const slider = document.getElementById('difficulty-slider');
const diffVal = document.getElementById('diff-val');
const gameWrapper = document.getElementById('game-wrapper');

const tabletContainer = document.getElementById('tablet-container');
const cctvTrigger = document.getElementById('cctv-trigger');
const cctvText = document.getElementById('cctv-text');
const cctvLed = document.getElementById('cctv-led');
const doorBtn = document.getElementById('door-btn');
const clockDisplay = document.getElementById('clock-display');
const timerSmall = document.getElementById('timer-small');
const doorPanel = document.getElementById('door-panel');

let scene, camera, renderer, doorMesh, enemyMesh, purpleEnemyMesh, pointLight, fanBlades, doorLightMesh, deskLight, fanBtn;
let ventDoorMesh, ventButtonMesh, ventLight, ambientLight; 
let doorTexPowered, doorTexUnpowered; 

let mouseX = 0;

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let ambientOscillator = null;

function init() {
    init3D();
    showTitleState();
    window.addEventListener('click', onMouseClick);
    window.addEventListener('resize', resizeGame); 
    resizeGame(); 
}

function resizeGame() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const windowRatio = windowWidth / windowHeight;
    let newWidth, newHeight;
    if (windowRatio > ASPECT_RATIO) {
        newHeight = windowHeight;
        newWidth = newHeight * ASPECT_RATIO;
    } else {
        newWidth = windowWidth;
        newHeight = newWidth / ASPECT_RATIO;
    }
    gameWrapper.style.width = `${newWidth}px`;
    gameWrapper.style.height = `${newHeight}px`;
    if (camera && renderer) {
        camera.aspect = ASPECT_RATIO;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    }
}

function onMouseClick(event) {
    if (event.target !== renderer.domElement) return;
    if (!gameActive || isTabletUp || isJumpscaring) return;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    if (ventButtonMesh) {
        const intersects = raycaster.intersectObject(ventButtonMesh);
        if (intersects.length > 0) toggleVent();
    }
}

function startAmbientSound() {
    if (ambientOscillator) return;
    ambientOscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    ambientOscillator.type = 'sine';
    ambientOscillator.frequency.value = 60; 
    gain.gain.value = 0.05; 
    ambientOscillator.connect(gain);
    gain.connect(audioCtx.destination);
    ambientOscillator.start();
}

function stopAmbientSound() {
    if (ambientOscillator) {
        ambientOscillator.stop();
        ambientOscillator = null;
    }
}

function startNight1() {
    aggressionLevel = 1; 
    if (audioCtx.state === 'suspended') audioCtx.resume();
    launchGameSequence();
    startAmbientSound();
}

function showCustomNight() {
    titleScreen.classList.add('hidden');
    customNightMenu.classList.remove('hidden');
}

function backToTitle() {
    customNightMenu.classList.add('hidden');
    titleScreen.classList.remove('hidden');
    showTitleState();
}

function startGameFromCustom() {
    aggressionLevel = parseInt(slider.value);
    if (audioCtx.state === 'suspended') audioCtx.resume();
    customNightMenu.classList.add('hidden');
    launchGameSequence();
    startAmbientSound();
}

function launchGameSequence() {
    titleScreen.classList.add('hidden');
    customNightMenu.classList.add('hidden');
    uiLayer.classList.remove('hidden');
    
    gameActive = true;
    isJumpscaring = false; 
    currentTime = 0;
    currentEnergy = 100;
    lightTimer = 0;
    nextFlickerTime = 5; 
    isFlickering = false;
    isDoorClosed = false;
    isVentClosed = false;
    isPowerOut = false;
    isTabletUp = false;
    
    currentWaypoint = 0;
    purpleWaypoint = 0;
    isRedAttacking = false;
    isPurpleAttacking = false;
    
    lastFrameTime = performance.now();
    
    if(enemyMoveTimer) clearTimeout(enemyMoveTimer);
    if(enemyPatienceTimer) clearTimeout(enemyPatienceTimer);
    if(purpleMoveTimer) clearTimeout(purpleMoveTimer);
    if(purpleAttackTimer) clearTimeout(purpleAttackTimer);

    tabletContainer.classList.remove('active');
    updateUI();
    resetDoorUI();
    resetVentUI();
    resetCctvUI();
    resetEnemyForGame();
    
    scheduleNextEnemyMove();
    scheduleNextPurpleMove(); 
    
    camera.position.set(0, 1.25, 1.6);
    camera.rotation.set(0, 0, 0);
    camera.lookAt(0, 1.0, -2);
    
    if(pointLight) pointLight.intensity = 2.0;
    if(deskLight) deskLight.intensity = 0.5;
    if(ventLight) ventLight.intensity = 1.0;
    if(ambientLight) {
        ambientLight.color.setHex(0x404040);
        ambientLight.intensity = 1.5;
    }
    if(doorLightMesh) doorLightMesh.material.emissiveIntensity = 1;
    if(fanBtn) fanBtn.material.color.setHex(0x00ff00);
    
    if(doorMesh) doorMesh.material.map = doorTexPowered;
    if(ventDoorMesh) ventDoorMesh.material.map = doorTexPowered;

    gameLoop();
}

function restartGame() {
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    resetEnemy3D();
    launchGameSequence(); 
}

function returnToMenu() {
    gameActive = false;
    isJumpscaring = false;
    stopAmbientSound();
    
    if(enemyMoveTimer) clearTimeout(enemyMoveTimer);
    if(enemyPatienceTimer) clearTimeout(enemyPatienceTimer);
    if(purpleMoveTimer) clearTimeout(purpleMoveTimer);
    if(purpleAttackTimer) clearTimeout(purpleAttackTimer);
    
    currentEnergy = 100;
    isDoorClosed = false;
    isVentClosed = false;
    isPowerOut = false;
    isTabletUp = false;
    currentWaypoint = 0;
    purpleWaypoint = 0;
    isRedAttacking = false;
    isPurpleAttacking = false;

    document.getElementById('ui-layer').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('win-screen').classList.add('hidden');
    document.getElementById('custom-night-menu').classList.add('hidden');
    document.getElementById('title-screen').classList.remove('hidden');
    document.getElementById('door-panel').classList.remove('hidden-ui'); 
    const tablet = document.getElementById('tablet-container');
    tablet.classList.remove('active');
    document.getElementById('static-effect').style.opacity = '0';
    resetCctvUI();
    resetDoorUI();
    resetVentUI();
    
    if(doorMesh) {
        doorMesh.position.set(0, 4.1, -1.6);
        doorMesh.material.map = doorTexPowered;
    }
    if(ventDoorMesh) {
        ventDoorMesh.position.y = 1.3;
        ventDoorMesh.material.map = doorTexPowered;
    }
    
    if(pointLight) pointLight.intensity = 2.0;
    if(doorLightMesh) doorLightMesh.material.emissiveIntensity = 1;
    if(fanBtn) fanBtn.material.color.setHex(0x00ff00);
    if(ambientLight) {
        ambientLight.color.setHex(0x404040);
        ambientLight.intensity = 1.5;
    }

    if(camera) {
        camera.position.set(0, 1.25, 1.6);
        camera.rotation.set(0, 0, 0); 
        camera.lookAt(0, 1.0, -2);    
    }
    mouseX = 0; 
    
    resetEnemyForGame();
    renderMenu();
}

slider.addEventListener('input', (e) => {
    diffVal.innerText = e.target.value;
    playSound('select');
});

window.addEventListener('mousemove', (e) => {
    if (!gameActive || isTabletUp || isJumpscaring) return;
    const rect = renderer.domElement.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouseX = x;
    if (camera) {
        camera.rotation.y = -Math.max(0, x) * 0.3; 
    }
    if (x > 0.4) {
        cctvTrigger.classList.add('visible');
    } else if (!isTabletUp) {
        cctvTrigger.classList.remove('visible');
    }
    if (mouseX > 0.3) {
        doorPanel.classList.add('hidden-ui');
    } else {
        doorPanel.classList.remove('hidden-ui');
    }
});

function updateCctvButtonVisibility() {
    if (isTabletUp) {
        cctvTrigger.classList.add('visible');
    }
}

function renderMenu() {
    if(!gameActive) {
        requestAnimationFrame(renderMenu);
        renderer.render(scene, camera);
    }
}

let lastFrameTime = performance.now();
function gameLoop() {
    if (isJumpscaring) {
        renderer.render(scene, camera);
        return;
    }
    if (!gameActive) return; 
    requestAnimationFrame(gameLoop);

    const now = performance.now();
    const deltaTime = (now - lastFrameTime) / 1000;
    lastFrameTime = now;
    
    updateCctvButtonVisibility();
    currentTime += deltaTime;
    updateLights(deltaTime);

    if (currentTime >= GAME_DURATION_SECONDS) {
        triggerWin();
        return;
    }
    updateClock();
    
    // --- CALCUL ENERGIE ACTUALIZAT (MAI GREU) ---
    let activeSystems = 0;
    if (isDoorClosed) activeSystems++;
    if (isVentClosed) activeSystems++;
    if (isTabletUp) activeSystems++;
    
    // Rata de bază crescută pentru un consum mai rapid
    let drainRate = 0.18; 
    let usageLevel = 1;

    if (activeSystems === 1) {
        drainRate = 0.32; // Un sistem activ consumă acum mai mult
        usageLevel = 2;
    } else if (activeSystems >= 2) {
        drainRate = 0.55 + ((activeSystems - 2) * 0.25); // Sisteme multiple secătuiesc bateria rapid
        usageLevel = 3;
    }
    
    if (isPowerOut) {
        drainRate = 0;
        usageLevel = 0;
    }
    
    updateUsageUI(usageLevel);
    if (currentEnergy > 0) {
        currentEnergy -= drainRate * deltaTime;
        if (currentEnergy <= 0) triggerPowerOutage();
    }
    updateEnergyUI();
    animate3DItems();
    renderer.render(scene, camera);
}

function updateLights(deltaTime) {
    if(isPowerOut) {
        pointLight.intensity = 0;
        deskLight.intensity = 0;
        ventLight.intensity = 0;
        doorLightMesh.material.emissiveIntensity = 0;
        return;
    }

    lightTimer += deltaTime;
    if (!isFlickering && lightTimer >= nextFlickerTime) {
        isFlickering = true;
        const flickerDuration = 0.5 + Math.random(); 
        setTimeout(() => {
            isFlickering = false;
            lightTimer = 0;
            const intervals = [4, 5, 9];
            nextFlickerTime = intervals[Math.floor(Math.random() * intervals.length)];
            pointLight.intensity = 2.0;
            doorLightMesh.material.emissiveIntensity = 1;
            if(ventLight) ventLight.intensity = 1.0;
        }, flickerDuration * 1000);
    }
    if (isFlickering) {
        const intensity = Math.random() > 0.7 ? 0.1 : (1.5 + Math.random());
        pointLight.intensity = intensity;
        doorLightMesh.material.emissiveIntensity = intensity * 0.5;
        if(ventLight) ventLight.intensity = intensity * 0.2;
    }
}

function updateUsageUI(level) {
    const u1 = document.getElementById('usage-1');
    const u2 = document.getElementById('usage-2');
    const u3 = document.getElementById('usage-3');
    u1.className = 'usage-block';
    u2.className = 'usage-block';
    u3.className = 'usage-block';
    if (level >= 1) u1.className = 'usage-block active-green';
    if (level >= 2) {
        if (level === 2) {
            u2.className = 'usage-block active-yellow';
        }
        else if (level >= 3) {
            u2.className = 'usage-block active-red blink-urgent';
            u3.className = 'usage-block active-red blink-urgent';
        }
    }
}

function toggleTablet() {
    if (isPowerOut || isJumpscaring) {
        playSound('error');
        return;
    }
    if (!gameActive) return;
    isTabletUp = !isTabletUp;
    const staticEffect = document.getElementById('static-effect');
    if (isTabletUp) {
        tabletContainer.classList.add('active');
        staticEffect.style.opacity = '0.15';
        playSound('blip');
        cctvTrigger.classList.add('closing');
        cctvTrigger.classList.add('visible');
        cctvText.innerText = "CLOSE CCTV";
        cctvLed.classList.remove('bg-red-500', 'animate-pulse');
        cctvLed.classList.add('bg-white');
    } else {
        tabletContainer.classList.remove('active');
        staticEffect.style.opacity = '0';
        resetCctvUI();
    }
}

function resetCctvUI() {
    cctvTrigger.classList.remove('closing');
    cctvText.innerText = "OPEN CCTV";
    cctvLed.classList.add('bg-red-500', 'animate-pulse');
    cctvLed.classList.remove('bg-white');
}

function toggleDoor() {
    if (isPowerOut || isJumpscaring) {
        playSound('error');
        return;
    }
    if (!gameActive || isTabletUp) return;
    isDoorClosed = !isDoorClosed;
    const btn = document.getElementById('door-btn');
    if (isDoorClosed) {
        btn.classList.remove('bg-gray-800', 'text-gray-300', 'border-gray-600');
        btn.classList.add('bg-red-900', 'text-red-100', 'border-red-500', 'animate-pulse');
        playSound('slam');
    } else {
        resetDoorUI();
    }
}

function resetDoorUI() {
    const btn = document.getElementById('door-btn');
    btn.classList.remove('bg-red-900', 'text-red-100', 'border-red-500', 'animate-pulse');
    btn.classList.add('bg-gray-800', 'text-gray-300', 'border-gray-600');
    btn.disabled = false;
}

function toggleVent() {
    if (isPowerOut || isJumpscaring) {
        playSound('error');
        return;
    }
    if (!gameActive || isTabletUp) return;
    isVentClosed = !isVentClosed;
    
    if(ventButtonMesh) {
        if(isVentClosed) {
            ventButtonMesh.material.color.setHex(0x00ff00); 
            playSound('vent_slam');
        } else {
            ventButtonMesh.material.color.setHex(0x3333ff); 
        }
    }
}

function resetVentUI() {
    isVentClosed = false;
    if(ventButtonMesh) {
        ventButtonMesh.material.color.setHex(0x3333ff);
    }
}

function scheduleNextEnemyMove() {
    if (!gameActive || isRedAttacking) return; 
    if(enemyMoveTimer) clearTimeout(enemyMoveTimer);
    
    let delay = Math.max(1000, 5000 - (aggressionLevel * 150));
    delay += Math.random() * 1500;
    enemyMoveTimer = setTimeout(attemptEnemyMove, delay);
}

function attemptEnemyMove() {
    if (!gameActive || isRedAttacking) return;
    if (currentWaypoint >= 4) return;
    
    let chance = 0.2 + (aggressionLevel * 0.03);
    if (Math.random() < chance) {
        moveEnemy();
    } else {
        scheduleNextEnemyMove();
    }
}

function moveEnemy() {
    currentWaypoint++;
    updateUI();
    
    if (currentWaypoint === 4) { 
        enemyArrivedAtDoor();
    } else {
        if (isTabletUp) playSound('blip');
        scheduleNextEnemyMove();
    }
}

function enemyArrivedAtDoor() {
    if(isRedAttacking) return;
    isRedAttacking = true; 
    if(enemyMoveTimer) clearTimeout(enemyMoveTimer);

    playSound('alarm');
    enemyMesh.position.set(0, 0, -2.2); 
    enemyMesh.visible = true;
    
    const attackDelay = 3000 + Math.random() * 3000;
    
    if(enemyPatienceTimer) clearTimeout(enemyPatienceTimer);
    enemyPatienceTimer = setTimeout(() => {
        if (!gameActive) return;
        
        if (isDoorClosed) {
            playSound('bang'); 
            resetEnemy(); 
        } else {
            enemyMesh.position.z = 1.0; 
            triggerGameOver('red'); 
        }
    }, attackDelay);
}

function resetEnemy() {
    if (enemyPatienceTimer) clearTimeout(enemyPatienceTimer);
    
    isRedAttacking = false; 
    currentWaypoint = 0; 
    
    enemyMesh.visible = false;
    enemyMesh.position.set(0, 0, -5);
    
    updateUI();
    playSound('footsteps'); 
    scheduleNextEnemyMove(); 
}

function resetEnemy3D() {
    enemyMesh.visible = false;
    enemyMesh.position.set(0, 0, -5);
}

function scheduleNextPurpleMove() {
    if (!gameActive || isPurpleAttacking) return;
    if(purpleMoveTimer) clearTimeout(purpleMoveTimer);
    
    let delay = Math.max(2000, 7000 - (aggressionLevel * 200)); 
    delay += Math.random() * 2000;
    purpleMoveTimer = setTimeout(attemptPurpleMove, delay);
}

function attemptPurpleMove() {
    if (!gameActive || isPurpleAttacking) return;
    
    if (purpleWaypoint >= 2) return;
    
    let chance = 0.3 + (aggressionLevel * 0.02);
    if (Math.random() < chance) {
        movePurple();
    } else {
        scheduleNextPurpleMove();
    }
}

function movePurple() {
    purpleWaypoint++;
    updateUI();
    
    if (purpleWaypoint === 2) { 
        purpleArrivedAtVent();
    } else {
        if (isTabletUp) playSound('blip');
        scheduleNextPurpleMove();
    }
}

function purpleArrivedAtVent() {
    if(isPurpleAttacking) return;
    isPurpleAttacking = true;
    
    // --- LOGICA SUNET ACTUALIZATA (45% ȘANSĂ) ---
    if (Math.random() < 0.45) {
        playSound('footsteps'); 
    }
    
    purpleEnemyMesh.visible = false; 
    
    if(purpleMoveTimer) clearTimeout(purpleMoveTimer);

    if(purpleAttackTimer) clearTimeout(purpleAttackTimer);
    purpleAttackTimer = setTimeout(() => {
        if (!gameActive) return;
        
        if (isVentClosed) { 
            playSound('vent_slam'); 
            resetPurple();
        } else {
            purpleEnemyMesh.position.set(1.0, 1.0, 1.5); 
            purpleEnemyMesh.rotation.y = -0.5;
            triggerGameOver('purple'); 
        }
    }, 4000);
}

function resetPurple() {
    if(purpleAttackTimer) clearTimeout(purpleAttackTimer);
    
    isPurpleAttacking = false; 
    purpleWaypoint = 0; 
    
    purpleEnemyMesh.visible = false;
    updateUI(); 
    scheduleNextPurpleMove(); 
}

function updateUI() {
    nodes.forEach((n, i) => {
        if (n) {
            n.classList.remove('active', 'purple-detected');
            if (!isRedAttacking && i === currentWaypoint) {
                n.classList.add('active');
            }
            let pNode = -1;
            if (purpleWaypoint === 0) pNode = 0;
            else if (purpleWaypoint === 1) pNode = 2;
            else if (purpleWaypoint === 2) pNode = 3;

            if (!isPurpleAttacking && i === pNode) {
                n.classList.add('purple-detected');
            }
        }
    });
}

function triggerGameOver(killerType = 'red') {
    if (isJumpscaring || !gameActive) return;
    
    gameActive = false;
    isJumpscaring = true;
    stopAmbientSound();
    
    if(isTabletUp) {
        tabletContainer.classList.remove('active');
        document.getElementById('static-effect').style.opacity = '0';
        resetCctvUI();
        isTabletUp = false;
    }

    const killerMesh = killerType === 'purple' ? purpleEnemyMesh : enemyMesh;
    killerMesh.visible = true;

    killerMesh.position.copy(camera.position);
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    
    if(killerType === 'purple') {
         killerMesh.position.add(direction.multiplyScalar(0.7)); 
         killerMesh.position.y -= 0.6; 
    } else {
         killerMesh.position.add(direction.multiplyScalar(0.6)); 
         killerMesh.position.y -= 0.4;
    }
    
    killerMesh.lookAt(camera.position);
    playSound('scream');
    renderer.render(scene, camera);

    setTimeout(() => {
        document.getElementById('game-over-screen').classList.remove('hidden');
    }, 2000);
}

function triggerWin() {
    gameActive = false;
    stopAmbientSound();
    document.getElementById('win-screen').classList.remove('hidden');
}

function triggerPowerOutage() {
    if (isPowerOut) return; 
    isPowerOut = true;
    currentEnergy = 0;
    if (isDoorClosed) {
        isDoorClosed = false;
        resetDoorUI();
    }
    if (isVentClosed) {
        isVentClosed = false;
        resetVentUI();
    }
    if (isTabletUp) {
        isTabletUp = false;
        tabletContainer.classList.remove('active');
        document.getElementById('static-effect').style.opacity = '0';
        resetCctvUI();
    }
    
    pointLight.intensity = 0;
    deskLight.intensity = 0;
    ventLight.intensity = 0;
    doorLightMesh.material.emissiveIntensity = 0;
    
    ambientLight.color.setHex(0x000022); 
    ambientLight.intensity = 0.15; 
    
    if(doorMesh) doorMesh.material.map = doorTexUnpowered;
    if(ventDoorMesh) ventDoorMesh.material.map = doorTexUnpowered;

    if(fanBtn) fanBtn.material.color.setHex(0x002200);
    stopAmbientSound();
    playSound('powerdown');
}

function updateClock() {
    const totalHours = 6;
    const progress = currentTime / GAME_DURATION_SECONDS;
    const hoursPassed = progress * totalHours;
    let displayHour = Math.floor(hoursPassed);
    if (displayHour === 0) displayHour = 12;
    clockDisplay.innerText = `${displayHour} AM`;
    const minutes = Math.floor(currentTime / 60);
    const seconds = Math.floor(currentTime % 60);
    const ms = Math.floor((currentTime % 1) * 100);
    timerSmall.innerText = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}:${ms.toString().padStart(2,'0')}`;
}

function updateEnergyUI() {
    const bar = document.getElementById('energy-bar');
    const txt = document.getElementById('energy-text');
    const val = Math.max(0, Math.floor(currentEnergy));
    bar.style.width = `${val}%`;
    txt.innerText = `${val}%`;
    if (currentEnergy < 20) {
        bar.style.backgroundColor = '#ef4444'; 
        txt.classList.add('text-red-500');
        txt.classList.remove('text-white');
    } else {
        bar.style.backgroundColor = '#ffffff'; 
        txt.classList.remove('text-red-500');
        txt.classList.add('text-white');
    }
}

function init3D() {
    const container = document.getElementById('scene-container');
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050505);
    scene.fog = new THREE.Fog(0x000000, 1, 12); 

    camera = new THREE.PerspectiveCamera(100, ASPECT_RATIO, 0.1, 100); 
    camera.position.set(0, 1.25, 1.6); 
    camera.lookAt(0, 1.0, -2); 

    renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1));
    
    container.appendChild(renderer.domElement);

    function createDoorTexture(isPowered) {
        const canvas = document.createElement('canvas');
        canvas.width = 256; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0,0,256,256);
        ctx.fillStyle = '#1a1a1a';
        for(let y=20; y<236; y+=20) { ctx.fillRect(0, y, 256, 10); }
        const stripeColor = isPowered ? '#eab308' : '#0a0a0a'; 
        const stripeBg = '#000000'; 
        function drawHazard(yStart, height) {
            ctx.save();
            ctx.beginPath(); ctx.rect(0, yStart, 256, height); ctx.clip();
            ctx.fillStyle = stripeBg; ctx.fillRect(0, yStart, 256, height);
            ctx.fillStyle = stripeColor;
            for(let i=-256; i<512; i+=30) {
                ctx.beginPath(); ctx.moveTo(i, yStart); ctx.lineTo(i+15, yStart); ctx.lineTo(i-15, yStart+height); ctx.lineTo(i-30, yStart+height); ctx.fill();
            }
            ctx.restore();
        }
        drawHazard(0, 20); drawHazard(236, 20); 
        return new THREE.CanvasTexture(canvas);
    }
    doorTexPowered = createDoorTexture(true);
    doorTexUnpowered = createDoorTexture(false);

    const ceilingCanvas = document.createElement('canvas');
    ceilingCanvas.width = 512; ceilingCanvas.height = 512;
    const cCtx = ceilingCanvas.getContext('2d');
    cCtx.fillStyle = '#1a1a1a'; cCtx.fillRect(0,0,512,512);
    cCtx.strokeStyle = '#0a0a0a'; cCtx.lineWidth = 4;
    for(let i=0; i<=512; i+=128) {
        cCtx.beginPath(); cCtx.moveTo(0, i); cCtx.lineTo(512, i); cCtx.stroke();
        cCtx.beginPath(); cCtx.moveTo(i, 0); cCtx.lineTo(i, 512); cCtx.stroke();
    }
    const ceilingTex = new THREE.CanvasTexture(ceilingCanvas);
    ceilingTex.wrapS = THREE.RepeatWrapping; ceilingTex.wrapT = THREE.RepeatWrapping;
    ceilingTex.repeat.set(4, 4);

    const mat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), mat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    
    const ceilMat = new THREE.MeshStandardMaterial({ map: ceilingTex, color: 0x333333, roughness: 0.9 });
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), ceilMat);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = 3;
    scene.add(ceil);

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const backWallL = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.5), wallMat);
    backWallL.position.set(-4.1, 1.5, -2);
    scene.add(backWallL);
    const backWallR = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 0.5), wallMat);
    backWallR.position.set(4.1, 1.5, -2);
    scene.add(backWallR);

    const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a });
    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3, 8), sideWallMat);
    leftWall.position.set(-2.2, 1.5, 1.0); 
    scene.add(leftWall);

    const ventGroup = new THREE.Group();
    const ventFrameGeo = new THREE.BoxGeometry(1.2, 1.0, 0.1); 
    const ventFrameMat = new THREE.MeshStandardMaterial({ color: 0x111111 }); 
    const ventFrame = new THREE.Mesh(ventFrameGeo, ventFrameMat);
    ventGroup.add(ventFrame);
    
    const housingGeo = new THREE.BoxGeometry(1.2, 1.2, 0.15); 
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x050505 }); 
    const ventHousing = new THREE.Mesh(housingGeo, housingMat);
    ventHousing.position.set(0, 1.1, 0.05); 
    ventGroup.add(ventHousing);

    const ventHole = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.8), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    ventHole.position.z = 0.06;
    ventGroup.add(ventHole);
    
    const vDoorGeo = new THREE.BoxGeometry(1.05, 1.2, 0.05);
    const vDoorMat = new THREE.MeshStandardMaterial({ map: doorTexPowered, color: 0xaaaaaa, metalness: 0.6, roughness: 0.8 });
    ventDoorMesh = new THREE.Mesh(vDoorGeo, vDoorMat);
    ventDoorMesh.position.set(0, 1.3, 0.04); 
    ventGroup.add(ventDoorMesh);
    
    const vBtnGeo = new THREE.BoxGeometry(0.3, 0.3, 0.1); 
    const vBtnMat = new THREE.MeshStandardMaterial({ color: 0x3333ff, emissive: 0x111155 }); 
    ventButtonMesh = new THREE.Mesh(vBtnGeo, vBtnMat);
    ventButtonMesh.position.set(0, -0.65, 0); 
    ventGroup.add(ventButtonMesh);

    ventGroup.position.set(-1.9, 1.5, 0.0); 
    ventGroup.rotation.y = Math.PI / 2;     
    scene.add(ventGroup);
    
    ventLight = new THREE.PointLight(0x3333ff, 1.0, 5);
    ventLight.position.set(-1.7, 1.5, 0.0); 
    scene.add(ventLight);

    const frameMat = new THREE.MeshStandardMaterial({ color: 0x050505 }); 
    const frameLeft = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 0.6), frameMat);
    frameLeft.position.set(-1.8, 1.4, -1.9); 
    scene.add(frameLeft);
    const frameRight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.8, 0.6), frameMat);
    frameRight.position.set(1.8, 1.4, -1.9);
    scene.add(frameRight);
    
    const housingGeo2 = new THREE.BoxGeometry(4.4, 0.6, 0.8); 
    const housing = new THREE.Mesh(housingGeo2, frameMat);
    housing.position.set(0, 2.9, -1.7); 
    scene.add(housing);
    
    const stripeGeo = new THREE.BoxGeometry(4.2, 0.05, 0.82);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xeab308 });
    const housingStripe = new THREE.Mesh(stripeGeo, stripeMat);
    housingStripe.position.set(0, 2.7, -1.7);
    scene.add(housingStripe);

    const doorGeo = new THREE.BoxGeometry(3.1, 3.5, 0.15);
    const doorMat = new THREE.MeshStandardMaterial({ map: doorTexPowered, color: 0xffffff, roughness: 0.7, metalness: 0.3 });
    doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.position.set(0, 4.1, -1.6); 
    scene.add(doorMesh);

    const deskGroup = new THREE.Group();
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x2a1d15 }));
    deskTop.position.set(0, 0.8, 0); 
    deskGroup.add(deskTop);
    const legGeo = new THREE.BoxGeometry(0.1, 0.8, 0.1);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x1a110d });
    const l1 = new THREE.Mesh(legGeo, legMat); l1.position.set(-1.0, 0.4, 0.4); deskGroup.add(l1);
    const l2 = new THREE.Mesh(legGeo, legMat); l2.position.set(1.0, 0.4, 0.4); deskGroup.add(l2);
    const l3 = new THREE.Mesh(legGeo, legMat); l3.position.set(-1.0, 0.4, -0.4); deskGroup.add(l3);
    const l4 = new THREE.Mesh(legGeo, legMat); l4.position.set(1.0, 0.4, -0.4); deskGroup.add(l4);
    const paperGeo = new THREE.PlaneGeometry(0.2, 0.3); 
    const paperMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const p1 = new THREE.Mesh(paperGeo, paperMat); p1.rotation.x = -Math.PI/2; p1.rotation.z = 0.2; p1.position.set(-0.3, 0.81, 0.2);
    const p2 = new THREE.Mesh(paperGeo, paperMat); p2.rotation.x = -Math.PI/2; p2.rotation.z = -0.1; p2.position.set(0.1, 0.815, 0.1);
    deskGroup.add(p1); deskGroup.add(p2);
    deskGroup.position.set(0, 0, 1.0); 
    scene.add(deskGroup);

    const fanGroup = new THREE.Group();
    const fanMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.4 });
    const cageMat = new THREE.MeshStandardMaterial({ color: 0x222222, wireframe: false }); 
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.05, 16), fanMat);
    fanBtn = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.02), new THREE.MeshStandardMaterial({color: 0x00ff00}));
    fanBtn.position.set(0.05, 0.03, 0.12);
    base.add(fanBtn);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.3), fanMat);
    stem.position.y = 0.15;
    const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.15), fanMat);
    motor.rotation.x = Math.PI / 2;
    motor.position.y = 0.35;
    const cage = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.01, 8, 24), cageMat);
    cage.position.set(0, 0.35, 0.1);
    const spokeGeo = new THREE.BoxGeometry(0.01, 0.6, 0.01);
    const spoke1 = new THREE.Mesh(spokeGeo, cageMat); spoke1.position.set(0, 0.35, 0.11);
    const spoke2 = new THREE.Mesh(spokeGeo, cageMat); spoke2.rotation.z = Math.PI/2; spoke2.position.set(0, 0.35, 0.11);
    fanBlades = new THREE.Group();
    fanBlades.position.set(0, 0.35, 0.12);
    const bladeGeo = new THREE.BoxGeometry(0.06, 0.5, 0.02);
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
    const b1 = new THREE.Mesh(bladeGeo, bladeMat); 
    const b2 = new THREE.Mesh(bladeGeo, bladeMat); b2.rotation.z = Math.PI/2;
    fanBlades.add(b1); fanBlades.add(b2);
    fanGroup.add(base); fanGroup.add(stem); fanGroup.add(motor); 
    fanGroup.add(cage); fanGroup.add(spoke1); fanGroup.add(spoke2);
    fanGroup.add(fanBlades);
    fanGroup.position.set(0.8, 0.85, 1.0); 
    fanGroup.rotation.y = -0.5;
    scene.add(fanGroup);

    enemyMesh = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 1.8), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 }));
    body.position.y = 0.9;
    enemyMesh.add(body);
    const eyeGeo = new THREE.SphereGeometry(0.05);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const e1 = new THREE.Mesh(eyeGeo, eyeMat); e1.position.set(-0.15, 1.6, 0.3);
    const e2 = new THREE.Mesh(eyeGeo, eyeMat); e2.position.set(0.15, 1.6, 0.3);
    enemyMesh.add(e1); enemyMesh.add(e2);
    enemyMesh.position.set(0, 0, -5);
    enemyMesh.visible = false;
    scene.add(enemyMesh);

    purpleEnemyMesh = new THREE.Group();
    const pBody = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a148c, roughness: 0.8 }));
    pBody.position.y = 0.8;
    purpleEnemyMesh.add(pBody);
    
    const pEyeMat = new THREE.MeshBasicMaterial({ color: 0xaa00ff, emissive: 0xaa00ff, emissiveIntensity: 2 });
    const pe1 = new THREE.Mesh(eyeGeo, pEyeMat); pe1.position.set(-0.12, 1.4, 0.28);
    const pe2 = new THREE.Mesh(eyeGeo, pEyeMat); pe2.position.set(0.12, 1.4, 0.28);
    purpleEnemyMesh.add(pe1); purpleEnemyMesh.add(pe2);
    
    purpleEnemyMesh.position.set(-2.8, 0.7, -3.0); 
    purpleEnemyMesh.visible = false;
    scene.add(purpleEnemyMesh);

    const bulbGeo = new THREE.SphereGeometry(0.15, 16, 16);
    const bulbMat = new THREE.MeshStandardMaterial({ color: 0xffffee, emissive: 0xffffee, emissiveIntensity: 1 });
    doorLightMesh = new THREE.Mesh(bulbGeo, bulbMat);
    doorLightMesh.position.set(0, 2.3, -2); 
    scene.add(doorLightMesh);

    pointLight = new THREE.PointLight(0xffffee, 2.0, 20); 
    pointLight.position.set(0, 2.2, -1.8); 
    scene.add(pointLight);

    deskLight = new THREE.PointLight(0xaaffaa, 0.5, 5);
    deskLight.position.set(0, 2, 1);
    scene.add(deskLight);

    ambientLight = new THREE.AmbientLight(0x404040, 1.5);
    scene.add(ambientLight);

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    });
    
    renderMenu();
}

function showTitleState() {
    if(enemyMesh) { enemyMesh.visible = false; }
}

function resetEnemyForGame() {
    if(enemyMesh) {
        enemyMesh.visible = false;
        enemyMesh.position.set(0, 0, -2.5);
        enemyMesh.rotation.y = 0;
    }
    if(purpleEnemyMesh) {
        purpleEnemyMesh.visible = false;
        purpleEnemyMesh.position.set(-3.0, 0.7, -3.0);
    }
}

function animate3DItems() {
    if (isJumpscaring) return;

    const time = Date.now() * 0.001;
    camera.position.y = 1.25 + Math.sin(time) * 0.015;

    const targetY = isDoorClosed ? 1.75 : 4.1; 
    doorMesh.position.y += (targetY - doorMesh.position.y) * 0.4; 
    
    const ventTargetY = isVentClosed ? 0.15 : 1.4; 
    if (ventDoorMesh) {
        ventDoorMesh.position.y += (ventTargetY - ventDoorMesh.position.y) * 0.4; 
    }

    if (fanBlades && !isPowerOut) {
        fanBlades.rotation.z -= 0.3; 
    }
}

function playSound(type) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const now = audioCtx.currentTime;

    if (type === 'blip') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(1000, now);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'select') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, now);
        gain.gain.setValueAtTime(0.05, now); gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
        osc.start(now); osc.stop(now + 0.05);
    } else if (type === 'slam') {
        osc.type = 'square'; osc.frequency.setValueAtTime(80, now); osc.frequency.exponentialRampToValueAtTime(0.01, now + 0.3);
        gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'vent_slam') {
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(300, now); 
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.2, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'bang') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(60, now); 
        osc.frequency.exponentialRampToValueAtTime(10, now + 0.2); 
        gain.gain.setValueAtTime(1.0, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3); 
        osc.start(now); osc.stop(now + 0.3);
    } else if (type === 'error') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(150, now); osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.2, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
    } else if (type === 'alarm') {
        osc.type = 'sawtooth'; osc.frequency.setValueAtTime(800, now); osc.frequency.linearRampToValueAtTime(600, now + 0.2);
        gain.gain.setValueAtTime(0.1, now); gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now); osc.stop(now + 0.4);
    } else if (type === 'scream') {
        osc.type = 'sawtooth'; 
        osc.frequency.setValueAtTime(600, now); 
        osc.frequency.linearRampToValueAtTime(1200, now + 0.1); 
        osc.frequency.linearRampToValueAtTime(300, now + 2.0); 
        
        gain.gain.setValueAtTime(0.8, now); 
        gain.gain.exponentialRampToValueAtTime(0.01, now + 2.0);
        
        osc.start(now); osc.stop(now + 2.0);
    } else if (type === 'powerdown') {
        osc.type = 'triangle'; 
        osc.frequency.setValueAtTime(200, now); 
        osc.frequency.exponentialRampToValueAtTime(30, now + 2); 
        gain.gain.setValueAtTime(0.15, now); 
        gain.gain.linearRampToValueAtTime(0, now + 2); 
        osc.start(now); 
        osc.stop(now + 2);
    } else if (type === 'footsteps') {
        const stepOsc = audioCtx.createOscillator();
        const stepGain = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        stepOsc.type = 'square';
        filter.type = 'lowpass';
        filter.frequency.value = 150;
        stepOsc.connect(filter);
        filter.connect(stepGain);
        stepGain.connect(audioCtx.destination);
        stepGain.gain.setValueAtTime(0.2, now);
        stepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        stepGain.gain.setValueAtTime(0.15, now + 0.3);
        stepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        stepGain.gain.setValueAtTime(0.1, now + 0.6);
        stepGain.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
        stepOsc.start(now);
        stepOsc.stop(now + 0.8);
    }
}

window.onload = init;