import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';
import { TextureLoader, RepeatWrapping } from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

class Scene {
    constructor() {
        this.container = document.querySelector('#scene-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.models = [];
        this.modelInitialRotations = new Map(); // 모델의 초기 회전값을 저장할 Map
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();
        this.originalCameraPosition = new THREE.Vector3(4.5, 1, 6);
        this.originalControlsTarget = new THREE.Vector3(4.5, 0, 0);
        this.selectedModel = null;
        this.isCameraMoving = false;
        this.cameraStartPosition = new THREE.Vector3();
        this.cameraEndPosition = new THREE.Vector3();
        this.controlsStartTarget = new THREE.Vector3();
        this.controlsEndTarget = new THREE.Vector3();
        this.cameraMoveStartTime = 0;
        this.cameraMoveDuration = 600;
        this.isWireframe = false;
        this.dragging = false;
        this.dragStart2D = { x: 0, y: 0 };
        this.dragEnd2D = { x: 0, y: 0 };
        this.dragBoxDiv = null;
        this.showDragBox = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.isJumping = false;
        this.jumpStartTime = 0;
        this.jumpDuration = 800; // 점프 애니메이션 지속 시간 (ms)
        this.jumpHeight = 0.25; // 점프 높이
        this.originalPositions = new Map(); // 모델의 초기 위치를 저장할 Map
        this.isPlaying = false; // 재생 상태를 추적하는 변수 추가
        this.playButton = null; // play 버튼 참조를 저장할 변수 추가
        this.autoRotate = true; // 자동 회전 활성화 여부
        this.rotationSpeed = 0.01; // 회전 속도 5배 증가
        this.rotationTime = 0; // 회전 시간 추적
        this.rotationRange = Math.PI / 4; // 45도 (라디안)
        this.shapekeyAnimationTime = 0; // shapekey 애니메이션을 위한 시간 변수 추가
        this.shapekeySpeed = 0.1; // 더 빠른 속도로 조정
        this.font = null;
        this.textMesh = null;       // 화면에 뿌릴 3D 텍스트 Mesh
        this.fontLoader = new FontLoader();
        this.uiElements = [];
        this.modelInitialCenters = new Map(); // 모델의 초기 중심점을 저장할 Map 추가
        this.isPhotoMode = false;  // 포토 모드 상태 추가
        this.isShiftPressed = false;  // Shift 키 상태 추가
        this.init();
    }

    init() {
        // 렌더러 설정
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.5;
        this.container.appendChild(this.renderer.domElement);
        
        // 배경색 설정
        this.scene.background = new THREE.Color(0xE0FFFF);

        // 카메라 위치 설정
        this.camera.position.set(4.5, 1, 6);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 2.0);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // 추가 조명들
        const pointLight1 = new THREE.PointLight(0xffffff, 1.5);
        pointLight1.position.set(-5, 5, -5);
        this.scene.add(pointLight1);

        const pointLight2 = new THREE.PointLight(0xffffff, 1.5);
        pointLight2.position.set(0, 5, -5);
        this.scene.add(pointLight2);

        const pointLight3 = new THREE.PointLight(0xffffff, 1.5);
        pointLight3.position.set(5, 5, -5);
        this.scene.add(pointLight3);

        // 폰트 로드
        this.fontLoader.load(
        'fonts/helvetiker_bold.typeface.json',
        (font) => { this.font = font; }
        );
        // 컨트롤 설정
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.target.copy(this.originalControlsTarget);

        // Environment Map
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        new EXRLoader()
            .setDataType(THREE.FloatType) // 중요!
            .load('envs/industrial_pipe_and_valve_01_4k.exr', (texture) => {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;

                this.scene.environment = envMap;
                this.scene.background = envMap;

                texture.dispose();
                pmremGenerator.dispose();
            });

        // Play 버튼 추가
        this.createPlayButton();

        // Auto Rotate 버튼 추가
        this.createAutoRotateButton();

        // Edit Mode 버튼 추가
        this.createEditModeButton();

        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener('resize', () => this.onWindowResize());

        // 마우스 이벤트 리스너 추가
        this.container.addEventListener('click', (event) => this.onMouseClick(event));

        // 드래그 박스용 div 생성
        this.createDragBoxDiv();
        // 마우스 드래그 이벤트 리스너 추가
        this.container.addEventListener('mousedown', (e) => this.handleDragStart(e));
        window.addEventListener('mousemove', (e) => this.handleDragMove(e));
        window.addEventListener('mouseup', (e) => this.handleDragEnd(e));
        
        // 아레나 생성
        this.createArena();

        // GLB 파일 로드
        this.loadModels();

        // 애니메이션 시작
        this.animate();

        // 버튼 일괄 제어를 위한 참조 저장
        this.uiElements = [
            ...this.container.querySelectorAll('button')
        ];

        // 키보드 이벤트 리스너 추가
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    // 아레나 생성 함수
    createArena() {
        const radius    = 9;    // ← 플랫폼·케이지 반지 반지름
        const thickness = 0.1;  // ← 플랫폼 두께
        const yOffset   = -0.57;  // ← 플랫폼 중심이 y=0에서 얼마나 위로 떠있을지
        const cageHeight = 3;   // ← 케이지 벽 높이
        const segments   = 8;   // ← 케이지 다각형 면 개수

        // 원하는 케이지 중심 좌표
        const cx = 4.5;    
        const cz = -0;  
        const logoSize   = radius * 0.8;   // 로고가 차지할 대각 크기


        // — 텍스처 로더 & 세팅 —
        const loader       = new TextureLoader();
        // — 1) 체인링크 알파맵 로드 —
        const fenceAlpha = loader.load(
            'textures/cage_wall_final.jpg',
            );
        fenceAlpha.wrapS = fenceAlpha.wrapT = RepeatWrapping;
        fenceAlpha.repeat.set(segments, 1);
        // — 2) 로고 맵 (투명 PNG 추천) —
        const logoTex = loader.load('textures/nubzuki_brainrot_logo.png', () => {
            // 반복 X
            logoTex.wrapS = logoTex.wrapT = THREE.ClampToEdgeWrapping;

            // 🔥 추가 필터 설정 (이게 중요)
            logoTex.minFilter = THREE.NearestFilter;
            logoTex.magFilter = THREE.NearestFilter;

            // 🔥 애니소트로피 설정
            logoTex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();

            logoTex.needsUpdate = true;
        });
        // 로고는 반복 필요 없으니 repeat.set(1,1)

        // — 1) 체인링크 케이지 벽 —
        const cageGeo = new THREE.CylinderGeometry(
            radius, radius, cageHeight, segments, 1, true
        );
        // 2) fenceMat 정의 — 알파맵과 alphaTest만으로 컷아웃 처리
        const fenceMat = new THREE.MeshStandardMaterial({
        color:       0x111111,     // 살아남을 선 색
        alphaMap:    fenceAlpha,  
        alphaTest:   0.5,          // 50% 미만 픽셀은 투명 컷아웃
        side:        THREE.DoubleSide,
        metalness:   0.6,
        roughness:   0.4
        });

        // 3) 알파맵 반전 (필요하다면)
        // fenceMat.onBeforeCompile = (shader) => {
        // shader.fragmentShader = shader.fragmentShader.replace(
        //     'diffuseColor.a *= texture2D( alphaMap, vUv ).r;',
        //     'diffuseColor.a *= (1.0 - texture2D( alphaMap, vUv ).r);'
        // );
        // };
        

        const fenceMesh = new THREE.Mesh(cageGeo, fenceMat);
        fenceMesh.position.set(
            cx,
            yOffset + cageHeight/2 + thickness/2,
            cz
        );
        this.scene.add(fenceMesh);

        // — 케이지 세그먼트 기둥 추가 —
        const postRadius = 0.2;  // 기둥 반지름
        const postHeight = cageHeight + 0.02;  // 약간 더 크게
        const postGeo = new THREE.CylinderGeometry(postRadius, postRadius, postHeight, 16);
        const postMat = new THREE.MeshStandardMaterial({
            color: 0x444444,
            metalness: 0.3,
            roughness: 0.8
        });

        // 세그먼트 수만큼 기둥 생성
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const x = cx + radius * Math.cos(angle);
            const z = cz + radius * Math.sin(angle);

            const post = new THREE.Mesh(postGeo, postMat);
            post.position.set(x, yOffset + postHeight / 2 + thickness / 2, z);
            this.scene.add(post);
        }

        // (Optional) 에지라인 남기고 싶으면 아래 두 줄 추가
        // const edges = new THREE.EdgesGeometry(cageGeo);
        // this.scene.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color:0x222222 })));

        // — 2) 반투명 플랫폼 (기존) —
        const platformGeo = new THREE.CylinderGeometry(radius, radius, thickness, 64);
        const platformMat = new THREE.MeshStandardMaterial({
            color:       0x888888,
            transparent: true,
            opacity:     0.8,
            side:        THREE.DoubleSide,
            roughness:   0.8,
            metalness:   0.2
        });
        const platform = new THREE.Mesh(platformGeo, platformMat);
        platform.position.set(cx, yOffset, cz);
        this.scene.add(platform);

        // — 3) 플랫폼 위 로고 렌더링 —
        // PlaneGeometry를 살짝 떠서 로고를 덮어씌움
        const logoGeo = new THREE.PlaneGeometry(logoSize, logoSize);
        const logoMat = new THREE.MeshBasicMaterial({
            map:         logoTex,
            transparent: true,       // PNG 알파 유지
            depthWrite:  false       // 플랫폼에 Z-파이팅 방지
        });
        const logoMesh = new THREE.Mesh(logoGeo, logoMat);
        logoMesh.rotation.x = -Math.PI/2;
        logoMesh.position.set(
            cx,
            yOffset + thickness/2 + 0.01,  // 플랫폼 윗면 바로 위
            cz
        );
        this.scene.add(logoMesh);
        }

    createPlayButton() {
        this.playButton = document.createElement('button');
        this.playButton.textContent = 'Play';
        this.playButton.style.position = 'absolute';
        this.playButton.style.bottom = '120px'; // Wireframe 버튼 위에 배치
        this.playButton.style.left = '20px';
        this.playButton.style.padding = '10px 20px';
        this.playButton.style.backgroundColor = '#ffffff';
        this.playButton.style.border = '1px solid #cccccc';
        this.playButton.style.borderRadius = '5px';
        this.playButton.style.cursor = 'pointer';
        this.playButton.style.zIndex = '1000';

        this.playButton.addEventListener('click', (event) => {
            event.stopPropagation();
            this.togglePlay();
        });

        this.container.appendChild(this.playButton);
        // 버튼 참조 저장
        if (!this.uiElements) this.uiElements = [];
        this.uiElements.push(this.playButton);
    }

    createAutoRotateButton() {
        const button = document.createElement('button');
        button.textContent = 'Stop Rotate';
        button.style.position = 'absolute';
        button.style.bottom = '160px'; // Play 버튼 위에 배치
        button.style.left = '20px';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#ffffff';
        button.style.border = '1px solid #cccccc';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.autoRotate = !this.autoRotate;
            button.textContent = this.autoRotate ? 'Stop Rotate' : 'Auto Rotate';
        });

        this.container.appendChild(button);
        // 버튼 참조 저장
        if (!this.uiElements) this.uiElements = [];
        this.uiElements.push(button);
    }

    createEditModeButton() {
        const button = document.createElement('button');
        button.textContent = 'Edit Mode';
        button.style.position = 'absolute';
        button.style.bottom = '200px'; // Auto Rotate 버튼 위에 배치
        button.style.left = '20px';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#ffffff';
        button.style.border = '1px solid #cccccc';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';

        button.addEventListener('click', (event) => {
            event.stopPropagation();
            this.togglePhotoMode();
            // 버튼 텍스트와 스타일 업데이트
            button.textContent = this.isPhotoMode ? 'Exit Edit Mode' : 'Edit Mode';
            button.style.backgroundColor = this.isPhotoMode ? '#ffeb3b' : '#ffffff';
        });

        this.container.appendChild(button);
        if (!this.uiElements) this.uiElements = [];
        this.uiElements.push(button);
    }

    createDragBoxDiv() {
        this.dragBoxDiv = document.createElement('div');
        this.dragBoxDiv.style.position = 'fixed';
        this.dragBoxDiv.style.border = '2px solid #00ff00';
        this.dragBoxDiv.style.background = 'rgba(0,255,0,0.15)';
        this.dragBoxDiv.style.pointerEvents = 'none';
        this.dragBoxDiv.style.display = 'none';
        this.dragBoxDiv.style.zIndex = '2000';
        document.body.appendChild(this.dragBoxDiv);
    }

    handleDragStart(event) {
        // 마우스 왼쪽 버튼만
        if (event.button !== 0) return;
        
        const target = event.target;
        if (target.tagName === 'BUTTON' || target.closest('button') || 
            target === this.rotateButton || target.closest('div[style*="position: absolute"]')) {
            return;
        }

        // 모델 선택 확인
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.models, true);
        
        if (intersects.length > 0) {
            // 모델을 클릭한 경우
            if (!this.selectedModel) {
                this.selectedModel = this.findParentModel(intersects[0].object);
            }
            this.dragging = true;
            this.dragStart2D = { x: event.clientX, y: event.clientY };
            this.dragEnd2D = { x: event.clientX, y: event.clientY };
            this.lastMouseX = event.clientX;
            this.lastMouseY = event.clientY;
            
            // 모델 컨트롤 시작 시 카메라 컨트롤 비활성화
            this.controls.enabled = false;
            
            if (this.showDragBox) {
                this.updateDragBoxDiv();
                this.dragBoxDiv.style.display = 'block';
            }
        } else {
            // 빈 영역을 클릭한 경우
            if (this.isPhotoMode && !this.isShiftPressed && !this.dragging) {
                // 포토 모드에서 shift 키를 누르지 않은 상태이고, 모델을 드래그 중이 아닐 때만 카메라 조작 활성화
                this.controls.enabled = true;
                this.controls.onMouseDown(event);
            }
        }
    }

    handleDragMove(event) {
        // shift 키를 누른 상태에서는 카메라 조작 비활성화
        if (this.isShiftPressed) {
            this.controls.enabled = false;
        }

        if (!this.dragging && !this.selectedModel) {
            // 드래그 중이 아니고 모델도 선택되지 않은 상태에서
            if (this.isPhotoMode && !this.isShiftPressed) {
                // 포토 모드에서 shift 키를 누르지 않은 상태에서만 카메라 조작
                this.controls.enabled = true;
                this.controls.onMouseMove(event);
            }
            return;
        }

        if (!this.dragging || !this.selectedModel) return;
        
        // 모델 컨트롤 중에는 카메라 컨트롤 비활성화
        this.controls.enabled = false;
        
        const currentX = event.clientX;
        const currentY = event.clientY;
        
        const deltaX = currentX - this.lastMouseX;
        const deltaY = currentY - this.lastMouseY;
        
        if (this.isPhotoMode && this.isShiftPressed) {
            // 포토 모드에서 Shift + 드래그로 모델 이동 (x축과 z축만)
            const moveSpeed = 0.05;
            this.selectedModel.position.x += deltaX * moveSpeed;
            this.selectedModel.position.z += deltaY * moveSpeed; // y 대신 z축으로 변경
        } else {
            // 일반 회전 모드
            const rotationSpeed = 0.005;
            this.selectedModel.rotation.y += deltaX * rotationSpeed;
            this.selectedModel.rotation.x += deltaY * rotationSpeed;
            this.selectedModel.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.selectedModel.rotation.x));
        }
        
        this.lastMouseX = currentX;
        this.lastMouseY = currentY;
        
        if (this.showDragBox) {
            this.updateDragBoxDiv();
        }
    }

    handleDragEnd(event) {
        if (!this.dragging) {
            if (this.isPhotoMode && !this.isShiftPressed) {
                // 포토 모드에서 shift 키를 누르지 않은 상태에서만 카메라 조작 종료
                this.controls.onMouseUp(event);
                // 모델 컨트롤이 끝난 후에만 카메라 컨트롤 활성화
                if (!this.selectedModel) {
                    this.controls.enabled = true;
                }
            }
            return;
        }
        this.dragging = false;
        if (this.showDragBox) {
            this.dragBoxDiv.style.display = 'none';
        }
    }

    updateDragBoxDiv() {
        const x1 = this.dragStart2D.x;
        const y1 = this.dragStart2D.y;
        const x2 = this.dragEnd2D.x;
        const y2 = this.dragEnd2D.y;
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        this.dragBoxDiv.style.left = left + 'px';
        this.dragBoxDiv.style.top = top + 'px';
        this.dragBoxDiv.style.width = width + 'px';
        this.dragBoxDiv.style.height = height + 'px';
    }

    onMouseClick(event) {
        console.log('=== Mouse Click Debug ===');
        console.log('Current selectedModel:', this.selectedModel);
        console.log('Is Photo Mode:', this.isPhotoMode);
        console.log('Is Playing:', this.isPlaying);

        // play 중이면 클릭 시 즉시 중단
        if (this.isPlaying) {
            console.log('Stopping play mode');
            this.isPlaying = false;
            this.showUI();
            this.playButton.textContent = 'Play';
            this.returnCameraToOriginalPosition();
            return;
        }

        // 포토 모드에서는 카메라 이동 없이 모델 선택만
        if (this.isPhotoMode) {
            console.log('Photo mode - handling model selection');
            this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.models, true);
            
            if (intersects.length > 0) {
                const clicked = this.findParentModel(intersects[0].object);
                console.log('Photo mode - clicked model:', clicked);
                if (clicked && this.selectedModel !== clicked) {
                    this.selectedModel = clicked;
                    this.showStats(clicked);
                }
            } else {
                console.log('Photo mode - clicked empty space');
                if (this.infoPanel) {
                    this.scene.remove(this.infoPanel);
                    this.infoPanel = null;
                }
                this.selectedModel = null;
            }
            return;
        }

        // 일반 모드에서는 기존 동작 유지
        console.log('Normal mode - handling click');
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.models, true);

        if (intersects.length > 0) {
            const clicked = this.findParentModel(intersects[0].object);
            console.log('Normal mode - clicked model:', clicked);
            if (clicked) {
                this.selectedModel = clicked;
                console.log('Setting selectedModel to:', clicked);
                this.moveCameraToModel(clicked);
                this.showStats(clicked);
            }
        } else {
            console.log('Normal mode - clicked empty space');
            console.log('Current selectedModel before check:', this.selectedModel);
            if (this.infoPanel) {
                this.scene.remove(this.infoPanel);
                this.infoPanel = null;
            }
            // 모델이 선택된 상태(zoom in 상태)에서만 카메라 원위치로 이동
            if (this.selectedModel) {
                console.log('Returning camera to original position');
                this.returnCameraToOriginalPosition();
                this.selectedModel = null;
                console.log('Cleared selectedModel');
            } else {
                console.log('No model selected, not returning camera');
            }
        }
        console.log('=== End Mouse Click Debug ===');
    }
    
    showStats(model) {
        // 이전 패널 제거
        if (this.infoPanel) {
            this.scene.remove(this.infoPanel);
            this.infoPanel = null;
        }
        if (!this.font) return;

        // 3) stats 라인 배열
        const stats = model.userData.stats;
        let nameLines = [];
        const name = stats.Name;

        // 이름 길면 두 줄로 나누기
        const maxLineLength = 21;
        if (name.length > maxLineLength) {
            const midpoint = Math.floor(name.length / 2);
            const splitIndex = name.lastIndexOf(' ', midpoint) > 0 ? name.lastIndexOf(' ', midpoint) : midpoint;
            nameLines = [name.slice(0, splitIndex), name.slice(splitIndex).trim()];
        } else {
            nameLines = [name];
        }

        // 줄 수에 맞춰 lines와 colors 생성
        const lines = [
            ...nameLines,
            `HP:     ${stats.HP}`,
            `Attack: ${stats.Attack}`
        ];

        const colors = [
            ...nameLines.map(() => 0xffffff),
            0xff0000,
            0xff0000
        ];

        // 4) Panel 그룹
        const panel = new THREE.Group();
        const textMeshes = [];

        let maxWidth = 0;
        const lineHeight = 0.3;
        const totalHeight = lines.length * lineHeight;

        // 5) 각 라인마다 TextGeometry, Mesh 생성
        lines.forEach((text, i) => {
            const geo = new TextGeometry(text, {
                font: this.font,
                size: 0.08,
                height: 0.02,
                curveSegments: 4,
                bevelEnabled: false
            });
            geo.computeBoundingBox();
            const bbox = geo.boundingBox;
            const w = bbox.max.x - bbox.min.x;
            maxWidth = Math.max(maxWidth, w);

            const mat = new THREE.MeshBasicMaterial({ color: colors[i] });
            const mesh = new THREE.Mesh(geo, mat);

            // 중앙 정렬
            mesh.position.set(-w / 2, -i * lineHeight, 0.001); // Z 살짝 앞으로
            textMeshes.push(mesh); // panel에는 나중에 추가
        });

        // 🎯 배경판 생성
        const paddingX = 0.1;
        const paddingY = 0.1;
        const bgWidth = maxWidth + paddingX * 2;
        const bgHeight = totalHeight + paddingY * 2;

        const bgGeo = new THREE.PlaneGeometry(bgWidth, bgHeight);
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.5,
            depthWrite: false
        });
        const bgMesh = new THREE.Mesh(bgGeo, bgMat);

        // 배경 중앙 정렬
        bgMesh.position.set(0, -totalHeight / 2 + lineHeight / 2, -0.01); // Z 살짝 뒤로

        // 🎯 panel에 배경 먼저 추가, 텍스트는 나중에
        panel.add(bgMesh);
        textMeshes.forEach(mesh => panel.add(mesh));

        // 6) 그룹 전체 가운데 정렬: 왼쪽 정렬이 아니라, 텍스트 시작점이 왼쪽에 딱 붙도록
        panel.children.forEach(child => {
            if (child !== bgMesh) {     // 배경은 제외
                const bb = child.geometry.boundingBox;
                child.position.x = -maxWidth / 2;
            }
        });

        // 7) 모델의 bounding box 이용해, panel 위치 잡기
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const leftX  = box.min.x;      // 모델의 가장 왼쪽
        const topY   = box.max.y;      // 모델의 가장 위

        // 살짝 왼쪽으로, 모델 높이 중앙에
        panel.position.set(
            leftX - 0.5,                  // 모델 옆으로 0.2m 만큼 더 왼쪽
            topY,                   // 모델 위쪽에서 내려와서
            center.z                      // Z는 모델 중앙과 동일
        );

        // 8) 카메라 바라보게
        // panel.lookAt(this.camera.position);

        // 9) 씬에 추가 & 참조 저장
        this.scene.add(panel);
        this.infoPanel = panel;
        }

    findParentModel(object) {
        let current = object;
        while (current.parent) {
            if (this.models.includes(current)) {
                return current;
            }
            current = current.parent;
        }
        return null;
    }

    moveCameraToModel(model) {
        console.log('=== moveCameraToModel Debug ===');
        console.log('Moving camera to model:', model);
        console.log('Current selectedModel:', this.selectedModel);

        // 선택된 모델 저장
        this.selectedModel = model;
        console.log('Set selectedModel to:', this.selectedModel);

        // 모델의 바운딩 박스 계산
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 모델의 크기에 따라 카메라 거리 계산
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.8;

        // 시작 위치와 목표 위치 설정
        this.cameraStartPosition.copy(this.camera.position);
        this.cameraEndPosition.set(
            center.x,
            center.y + this.jumpHeight,
            center.z + distance
        );

        this.controlsStartTarget.copy(this.controls.target);
        this.controlsEndTarget.copy(center);

        // 카메라 이동 시작
        this.isCameraMoving = true;
        this.cameraMoveStartTime = Date.now();

        // 모델 선택 시 컨트롤 비활성화
        this.controls.enabled = false;

        // 모델의 초기 위치 저장
        if (!this.originalPositions.has(model)) {
            this.originalPositions.set(model, {
                x: model.position.x,
                y: model.position.y,
                z: model.position.z
            });
        }

        // shapekey가 있는 모델(sahur, tra)이 아닌 경우에만 점프 애니메이션 시작
        let hasShapekey = false;
        model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                hasShapekey = true;
            }
        });

        if (!hasShapekey) {
            this.startJumpAnimation(model);
        }
        console.log('=== End moveCameraToModel Debug ===');
    }

    startJumpAnimation(model) {
        // 이미 점프 중인 모델이 있다면 중지
        if (this.isJumping) {
            this.isJumping = false;
        }

        this.isJumping = true;
        this.jumpStartTime = Date.now();

        // 모델의 초기 위치 저장
        if (!this.originalPositions.has(model)) {
            this.originalPositions.set(model, {
                x: model.position.x,
                y: model.position.y,
                z: model.position.z
            });
        }

        const animateJump = () => {
            if (!this.isJumping) return;

            const currentTime = Date.now();
            const elapsedTime = currentTime - this.jumpStartTime;
            const progress = (elapsedTime % this.jumpDuration) / this.jumpDuration;

            // 사인 함수를 사용하여 부드러운 점프 애니메이션 구현
            const jumpProgress = Math.sin(progress * Math.PI);
            const originalY = this.originalPositions.get(model).y;
            
            // 일정한 높이로 점프
            model.position.y = originalY + (this.jumpHeight * jumpProgress);

            requestAnimationFrame(animateJump);
        };

        animateJump();
    }

    returnCameraToOriginalPosition() {
        console.log('=== returnCameraToOriginalPosition Debug ===');
        console.log('Current selectedModel:', this.selectedModel);
        
        // 시작 위치와 목표 위치 설정
        this.cameraStartPosition.copy(this.camera.position);
        this.cameraEndPosition.copy(this.originalCameraPosition);

        this.controlsStartTarget.copy(this.controls.target);
        this.controlsEndTarget.copy(this.originalControlsTarget);

        // 카메라 이동 시작
        this.isCameraMoving = true;
        this.cameraMoveStartTime = Date.now();

        // 점프 애니메이션 중지
        this.isJumping = false;

        // 모든 모델을 초기 위치로 복원
        this.models.forEach(model => {
            const originalPosition = this.originalPositions.get(model);
            if (originalPosition) {
                model.position.y = originalPosition.y;
            }
        });

        // 모든 모델을 초기 회전값으로 복원
        this.models.forEach(model => {
            const initialRotation = this.modelInitialRotations.get(model);
            if (initialRotation) {
                // 회전 애니메이션을 위한 시작값 저장
                const startRotation = {
                    x: model.rotation.x,
                    y: model.rotation.y,
                    z: model.rotation.z
                };

                // 애니메이션 시작 시간 저장
                const rotationStartTime = Date.now();

                const animateRotation = () => {
                    const currentTime = Date.now();
                    const elapsedTime = currentTime - rotationStartTime;
                    const progress = Math.min(elapsedTime / this.cameraMoveDuration, 1);

                    // 부드러운 이징 함수 적용
                    const easedProgress = progress < 0.5
                        ? 4 * progress * progress * progress
                        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

                    // 회전값 보간
                    model.rotation.x = startRotation.x + (initialRotation.x - startRotation.x) * easedProgress;
                    model.rotation.y = startRotation.y + (initialRotation.y - startRotation.y) * easedProgress;
                    model.rotation.z = startRotation.z + (initialRotation.z - startRotation.z) * easedProgress;

                    if (progress < 1) {
                        requestAnimationFrame(animateRotation);
                    }
                };

                animateRotation();
            }
        });

        // 카메라 이동이 완료된 후에 모델 선택 해제
        const checkCameraMovement = () => {
            if (this.isCameraMoving) {
                requestAnimationFrame(checkCameraMovement);
            } else {
                // 카메라 이동이 완료된 후에 모델 선택 해제
                console.log('Camera movement complete, clearing selectedModel');
                this.selectedModel = null;
                // 컨트롤 다시 활성화
                this.controls.enabled = true;
            }
        };
        checkCameraMovement();
        console.log('=== End returnCameraToOriginalPosition Debug ===');
    }

    loadModels() {
        const loader = new GLTFLoader();
        
        // 화면 배치 순서: banini, lirili, sahur, tra
        const modelPaths = [
            'models/banini.glb',
            'models/lirili.glb',
            'models/sahur_shapekey.glb',
            'models/tra_shapekey.glb'
        ];
        const names = ['Nubjukchini Bananini', 'Nubchokchoki Jjillillala', 'Juk Juk Juk Juk Juk Juk Juk Juk, Nubzuru', 'Tralululala Nubrulala'];

        // Promise를 사용하여 순차적으로 모델 로드
        const loadModel = (path, index) => {
            return new Promise((resolve, reject) => {
                loader.load(
                    path,
                    (gltf) => {
                        const model = gltf.scene;
                        model.userData.stats = {
                            Name: names[index],
                            HP: Math.floor(Math.random() * 200) + 50,
                            Attack: Math.floor(Math.random() * 100) + 20
                        };
                        model.userData.label = names[index];
                        model.position.set(index * 3, 0, 0);
                        
                        this.modelInitialRotations.set(model, {
                            x: model.rotation.x,
                            y: model.rotation.y,
                            z: model.rotation.z
                        });
                        
                        // 모델의 초기 중심점 저장
                        const box = new THREE.Box3().setFromObject(model);
                        const center = box.getCenter(new THREE.Vector3());
                        this.modelInitialCenters.set(model, center.clone());
                        
                        model.traverse((child) => {
                            if (child.isMesh) {
                                if (child.material) {
                                    child.material.needsUpdate = true;
                                    child.material.metalness = 0.5;
                                    child.material.roughness = 0.5;
                                    child.material.envMapIntensity = 1.0;
                                    
                                    if ((path === 'models/sahur_shapekey.glb' || path === 'models/tra_shapekey.glb') && child.morphTargetDictionary) {
                                        child.material.morphTargets = true;
                                        child.material.morphNormals = true;
                                        
                                        if (child.morphTargetInfluences) {
                                            for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                                                child.morphTargetInfluences[i] = 0;
                                            }
                                        }
                                        
                                        child.material.needsUpdate = true;
                                    }
                                }
                            }
                        });
                        
                        this.scene.add(model);
                        this.models.push(model);
                        resolve();
                    },
                    (xhr) => {
                        console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                    },
                    (error) => {
                        console.error('An error happened', error);
                        reject(error);
                    }
                );
            });
        };

        // 순차적으로 모델 로드
        const loadModelsSequentially = async () => {
            for (let i = 0; i < modelPaths.length; i++) {
                try {
                    await loadModel(modelPaths[i], i);
                } catch (error) {
                    console.error(`Error loading model ${i}:`, error);
                }
            }
        };

        loadModelsSequentially();
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        this.shapekeyAnimationTime += this.shapekeySpeed;
        
        this.models.forEach(model => {
            model.traverse((child) => {
                if (child.isMesh && child.morphTargetDictionary) {
                    // 사인 함수를 사용하여 0~1 사이의 값으로 정규화
                    const value = (Math.sin(this.shapekeyAnimationTime) + 1) / 2;
                    
                    if (child.name === 'geometry_0') {
                        // morphTargets 활성화
                        child.material.morphTargets = true;
                        child.material.morphNormals = true;
                        
                        // 모든 shapekey에 대해 값을 설정
                        if (child.morphTargetInfluences) {
                            for (let i = 0; i < child.morphTargetInfluences.length; i++) {
                                child.morphTargetInfluences[i] = value;
                            }
                        }
                        
                        // 재질과 geometry 업데이트
                        child.material.needsUpdate = true;
                        if (child.geometry) {
                            child.geometry.attributes.position.needsUpdate = true;
                            child.geometry.attributes.normal.needsUpdate = true;
                        }
                    }
                }
            });
        });

        // 자동 회전 로직
        if (this.autoRotate) {
            this.rotationTime += this.rotationSpeed;
            const rotation = Math.sin(this.rotationTime) * this.rotationRange;
            
            this.models.forEach(model => {
                model.rotation.y = rotation;
            });
        }

        // 카메라 이동 애니메이션
        if (this.isCameraMoving) {
            const currentTime = Date.now();
            const elapsedTime = currentTime - this.cameraMoveStartTime;
            const progress = Math.min(elapsedTime / this.cameraMoveDuration, 1);

            // 부드러운 이징 함수 적용 (easeInOutCubic)
            const easedProgress = progress < 0.5
                ? 4 * progress * progress * progress
                : 1 - Math.pow(-2 * progress + 2, 3) / 2;

            // 카메라 위치 보간
            this.camera.position.lerpVectors(
                this.cameraStartPosition,
                this.cameraEndPosition,
                easedProgress
            );

            // 컨트롤 타겟 보간
            this.controls.target.lerpVectors(
                this.controlsStartTarget,
                this.controlsEndTarget,
                easedProgress
            );

            this.controls.update();

            // 애니메이션 완료 체크
            if (progress >= 1) {
                this.isCameraMoving = false;
            }
        }

        this.controls.update();
        // ★ infoPanel 이 있으면 항상 카메라를 바라보도록
            if ( this.infoPanel ) {
                this.infoPanel.lookAt( this.camera.position );
            }
        this.renderer.render(this.scene, this.camera);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.playButton.textContent = this.isPlaying ? 'Stop' : 'Play';
        if (this.isPlaying) {
            this.hideUI();
            this.startCameraTrajectory();
        } else {
            this.showUI();
            this.returnCameraToOriginalPosition();
        }
    }

    startCameraTrajectory() {
        const startTime = Date.now();
        const zoomOutDuration = 1000; // 1초 줌아웃
        const rotationDuration = 1500; // 1.5초 회전
        const moveDuration = 500; // 0.5초 이동
        const pauseDuration = 1250; // 1.25초 멈춤
        const finalZoomOutDuration = 500; // 0.5초 줌아웃
        const totalDuration = zoomOutDuration + rotationDuration + (moveDuration + pauseDuration) * this.models.length + finalZoomOutDuration;
        const center = new THREE.Vector3(4.5, 0, 0);
        const startPosition = this.camera.position.clone();
        const startTarget = this.controls.target.clone();

        // 모델 인덱스 변경 추적용
        let lastModelIndex = -1;

        // 현재 카메라 위치에서의 반지름과 각도 계산
        const dx = startPosition.x - center.x;
        const dz = startPosition.z - center.z;
        const radius = Math.sqrt(dx * dx + dz * dz);
        const startAngle = Math.atan2(dz, dx);

        // 카메라가 따라갈 모델 순서: sahur, banini, tra, lirili
        // models의 인덱스: banini(0), lirili(1), sahur(2), tra(3)
        const cameraModelOrder = [2, 0, 3, 1];

        const animate = () => {
            if (!this.isPlaying) {
                this.showUI();
                return;
            }
            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            if (elapsedTime < totalDuration) {
                let currentPosition;
                let currentTarget;
                if (elapsedTime < zoomOutDuration) {
                    // 초기 줌아웃 단계
                    const zoomOutProgress = elapsedTime / zoomOutDuration;
                    // 더 선형적인 이징 함수 사용
                    const easedProgress = zoomOutProgress;
                    
                    // 카메라를 뒤로 이동하고 위에서 아래를 내려다보는 각도로 설정
                    const targetPosition = new THREE.Vector3(
                        center.x + Math.cos(startAngle) * (radius + 5),
                        center.y + 5,
                        center.z + Math.sin(startAngle) * (radius + 5)
                    );
                    
                    currentPosition = new THREE.Vector3().lerpVectors(
                        startPosition,
                        targetPosition,
                        easedProgress
                    );
                    currentTarget = center.clone();
                } else if (elapsedTime < zoomOutDuration + rotationDuration) {
                    // 회전 단계
                    const rotationProgress = (elapsedTime - zoomOutDuration) / rotationDuration;
                    // 선형적인 회전 진행
                    const angle = startAngle + rotationProgress * Math.PI * 2;
                    currentPosition = new THREE.Vector3(
                        center.x + Math.cos(angle) * (radius + 5),
                        center.y + 5,
                        center.z + Math.sin(angle) * (radius + 5)
                    );
                    currentTarget = center.clone();
                } else {
                    const remainingTime = elapsedTime - (zoomOutDuration + rotationDuration);
                    const modelDuration = moveDuration + pauseDuration;
                    const currentModelIndex = Math.floor(remainingTime / modelDuration);
                    if (currentModelIndex < cameraModelOrder.length) {
                        const modelProgress = (remainingTime % modelDuration) / moveDuration;
                        const modelIdx = cameraModelOrder[currentModelIndex];
                        if (modelProgress < 1) {
                            // 더 부드러운 이징 함수 적용
                            const easedProgress = modelProgress < 0.5
                                ? 2 * modelProgress * modelProgress
                                : -1 + (4 - 2 * modelProgress) * modelProgress;
                            const model = this.models[modelIdx];
                            const box = new THREE.Box3().setFromObject(model);
                            const initialCenter = this.modelInitialCenters.get(model);
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            const distance = maxDim * 1.8;
                            
                            let prevPosition;
                            if (currentModelIndex === 0) {
                                // 회전이 끝난 위치에서 시작
                                const lastRotationAngle = startAngle + Math.PI * 2;
                                prevPosition = new THREE.Vector3(
                                    center.x + Math.cos(lastRotationAngle) * (radius + 5),
                                    center.y + 5,
                                    center.z + Math.sin(lastRotationAngle) * (radius + 5)
                                );
                            } else {
                                const prevModelIdx = cameraModelOrder[currentModelIndex - 1];
                                const prevModel = this.models[prevModelIdx];
                                const prevBox = new THREE.Box3().setFromObject(prevModel);
                                const prevInitialCenter = this.modelInitialCenters.get(prevModel);
                                const prevSize = prevBox.getSize(new THREE.Vector3());
                                const prevMaxDim = Math.max(prevSize.x, prevSize.y, prevSize.z);
                                const prevDistance = prevMaxDim * 1.8;
                                
                                prevPosition = new THREE.Vector3(
                                    prevInitialCenter.x,
                                    prevInitialCenter.y + this.jumpHeight,
                                    prevInitialCenter.z + prevDistance
                                );
                            }
                            
                            const targetPosition = new THREE.Vector3(
                                initialCenter.x,
                                initialCenter.y + this.jumpHeight,
                                initialCenter.z + distance
                            );
                            
                            currentPosition = new THREE.Vector3().lerpVectors(
                                prevPosition,
                                targetPosition,
                                easedProgress
                            );
                            currentTarget = new THREE.Vector3().lerpVectors(
                                currentModelIndex === 0 ? center : this.modelInitialCenters.get(this.models[cameraModelOrder[currentModelIndex - 1]]),
                                initialCenter,
                                easedProgress
                            );
                        } else {
                            const model = this.models[modelIdx];
                            const box = new THREE.Box3().setFromObject(model);
                            const initialCenter = this.modelInitialCenters.get(model);
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            const distance = maxDim * 1.8;
                            
                            currentPosition = new THREE.Vector3(
                                initialCenter.x,
                                initialCenter.y + this.jumpHeight,
                                initialCenter.z + distance
                            );
                            currentTarget = initialCenter.clone();
                        }
                        if (currentModelIndex !== lastModelIndex) {
                            this.showStats(this.models[modelIdx]);
                            // shapekey가 있는 모델(sahur, tra)이 아닌 경우에만 점프 애니메이션 시작
                            let hasShapekey = false;
                            this.models[modelIdx].traverse((child) => {
                                if (child.isMesh && child.morphTargetDictionary) {
                                    hasShapekey = true;
                                }
                            });
                            if (!hasShapekey) {
                                this.startJumpAnimation(this.models[modelIdx]);
                            }
                            lastModelIndex = currentModelIndex;
                        }
                    } else {
                        // 마지막 줌아웃 단계
                        if (this.infoPanel) {
                            this.scene.remove(this.infoPanel);
                            this.infoPanel = null;
                        }
                        if (this.isJumping) {
                            this.isJumping = false;
                        }
                        const zoomOutProgress = (elapsedTime - (zoomOutDuration + rotationDuration + modelDuration * cameraModelOrder.length)) / finalZoomOutDuration;
                        const easedProgress = zoomOutProgress < 0.5
                            ? 2 * zoomOutProgress * zoomOutProgress
                            : -1 + (4 - 2 * zoomOutProgress) * zoomOutProgress;
                        const lastModelIdx = cameraModelOrder[cameraModelOrder.length - 1];
                        const lastModel = this.models[lastModelIdx];
                        const lastBox = new THREE.Box3().setFromObject(lastModel);
                        const lastInitialCenter = this.modelInitialCenters.get(lastModel);
                        const size = lastBox.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z);
                        const distance = maxDim * 1.8;
                        
                        const lastPosition = new THREE.Vector3(
                            lastInitialCenter.x,
                            lastInitialCenter.y + this.jumpHeight,
                            lastInitialCenter.z + distance
                        );
                        
                        currentPosition = new THREE.Vector3().lerpVectors(
                            lastPosition,
                            startPosition,
                            easedProgress
                        );
                        currentTarget = new THREE.Vector3().lerpVectors(
                            lastInitialCenter,
                            startTarget,
                            easedProgress
                        );
                    }
                }
                this.camera.position.copy(currentPosition);
                this.controls.target.copy(currentTarget);
                this.controls.update();
                requestAnimationFrame(animate);
            } else {
                this.camera.position.copy(startPosition);
                this.controls.target.copy(startTarget);
                this.controls.update();
                this.isPlaying = false;
                this.playButton.textContent = 'Play';
                this.showUI();
            }
        };
        animate();
    }

    // UI 숨기기/보이기 함수 수정: 플레이 중에는 안내 텍스트도 완전히 사라지게
    hideUI() {
        if (!this.uiElements) return;
        this.uiElements.forEach(el => {
            if (el && el.tagName === 'BUTTON') el.style.display = 'none';
        });
    }
    showUI() {
        if (!this.uiElements) return;
        this.uiElements.forEach(el => {
            if (el && el.tagName === 'BUTTON') el.style.display = 'block';
        });
    }

    togglePhotoMode() {
        this.isPhotoMode = !this.isPhotoMode;
        
        // Play 버튼 비활성화/활성화
        if (this.playButton) {
            this.playButton.disabled = this.isPhotoMode;
            this.playButton.style.opacity = this.isPhotoMode ? '0.5' : '1';
            this.playButton.style.cursor = this.isPhotoMode ? 'not-allowed' : 'pointer';
        }
        
        if (this.isPhotoMode) {
            // 포토 모드 진입
            this.models.forEach(model => {
                // 모델의 바운딩 박스 계산
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const center = box.getCenter(new THREE.Vector3());
                
                // 모델의 초기 위치 저장
                if (!this.originalPositions.has(model)) {
                    this.originalPositions.set(model, {
                        x: model.position.x,
                        y: model.position.y,
                        z: model.position.z,
                        scale: model.scale.clone(),
                        rotation: {
                            x: model.rotation.x,
                            y: model.rotation.y,
                            z: model.rotation.z
                        }
                    });
                }
                
                // 바닥면을 기준으로 스케일 조정
                const scale = 3;
                const bottomY = model.position.y - (size.y / 2);
                const scaleRatio = scale / model.scale.x;
                
                // 스케일 적용
                model.scale.set(scale, scale, scale);
                
                // 바닥면 위치 유지를 위한 위치 조정
                model.position.y = bottomY + (size.y * scale / 2);
            });
            
            // 컨트롤 비활성화
            this.controls.enabled = false;
        } else {
            // 포토 모드 종료
            this.models.forEach(model => {
                // 원래 스케일, 위치, 회전값으로 복원
                const originalPosition = this.originalPositions.get(model);
                if (originalPosition) {
                    model.scale.copy(originalPosition.scale);
                    model.position.set(
                        originalPosition.x,
                        originalPosition.y,
                        originalPosition.z
                    );
                    model.rotation.set(
                        originalPosition.rotation.x,
                        originalPosition.rotation.y,
                        originalPosition.rotation.z
                    );
                }
            });
            
            // 컨트롤 다시 활성화
            this.controls.enabled = true;
        }
    }

    handleKeyDown(event) {
        if (event.key === 'Shift') {
            this.isShiftPressed = true;
            // shift 키를 누르면 카메라 컨트롤 비활성화
            this.controls.enabled = false;
        }
    }

    handleKeyUp(event) {
        if (event.key === 'Shift') {
            this.isShiftPressed = false;
            // shift 키를 떼면 카메라 컨트롤 다시 활성화 (포토 모드이고 드래그 중이 아닐 때만)
            if (this.isPhotoMode && !this.dragging) {
                this.controls.enabled = true;
            }
        }
    }
}

// 씬 초기화
new Scene(); 