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
        this.jumpDuration = 1000; // 점프 애니메이션 지속 시간 (ms)
        this.jumpHeight = 0.2; // 점프 높이를 0.5에서 0.2로 낮춤
        this.originalPositions = new Map(); // 모델의 초기 위치를 저장할 Map
        this.isPlaying = false; // 재생 상태를 추적하는 변수 추가
        this.playButton = null; // play 버튼 참조를 저장할 변수 추가
        this.autoRotate = true; // 자동 회전 활성화 여부
        this.rotationSpeed = 0.01; // 회전 속도 5배 증가
        this.rotationTime = 0; // 회전 시간 추적
        this.rotationRange = Math.PI / 4; // 45도 (라디안)
        this.morphingMeshes = [];
        this.morphingProgress = 0;
        this.isMorphing = false;
        this.morphingDuration = 2000; // 2초 동안 모핑
        this.morphingStartTime = 0;
        this.shapekeyAnimationTime = 0; // shapekey 애니메이션을 위한 시간 변수 추가
        this.shapekeySpeed = 0.1; // 더 빠른 속도로 조정
        this.font = null;
        this.textMesh = null;       // 화면에 뿌릴 3D 텍스트 Mesh
        this.fontLoader = new FontLoader();
        this.uiElements = [];
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
        
        // text
        this.infoDiv = document.createElement('div');
        this.container.style.position = 'relative';

        // infoDiv 스타일
        this.infoDiv = document.createElement('div');
        this.infoDiv.style.position        = 'absolute';
        this.infoDiv.style.top             = '20px';
        this.infoDiv.style.left            = '20px';
        this.infoDiv.style.zIndex          = '1000';
        this.infoDiv.style.pointerEvents   = 'none';

        this.infoDiv.style.padding = '8px 12px';
        this.infoDiv.style.background = 'rgba(255,255,255,0.8)';
        this.infoDiv.style.color = '#000';
        this.infoDiv.style.fontFamily = 'Arial, sans-serif';
        this.infoDiv.style.fontSize = '14px';
        this.infoDiv.textContent = 'Click a model';
        this.container.appendChild(this.infoDiv);

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
        this.controls.maxDistance = 6;

        // Environment Map
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();

        new EXRLoader()
            .setDataType(THREE.FloatType) // 중요!
            .load('envs/minedump_flats_4k.exr', (texture) => {
                const envMap = pmremGenerator.fromEquirectangular(texture).texture;

                this.scene.environment = envMap;
                this.scene.background = envMap;

                texture.dispose();
                pmremGenerator.dispose();
            });

        // Wireframe Toggle 버튼 추가
        this.createWireframeButton();

        // Play 버튼 추가
        this.createPlayButton();

        // Auto Rotate 버튼 추가
        this.createAutoRotateButton();

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

        // 버튼/안내 텍스트 일괄 제어를 위한 참조 저장
        this.uiElements = [
            ...this.container.querySelectorAll('button'),
            this.infoDiv
        ];
        // 안내 텍스트 원본 저장
        this.infoDivOriginalText = this.infoDiv.textContent;
    }

    // 아레나 생성 함수
    createArena() {
        const radius    = 9;    // ← 플랫폼·케이지 반지 반지름
        const thickness = 0.1;  // ← 플랫폼 두께
        const yOffset   = -0.6;  // ← 플랫폼 중심이 y=0에서 얼마나 위로 떠있을지
        const cageHeight = 3;   // ← 케이지 벽 높이
        const segments   = 8;   // ← 케이지 다각형 면 개수

        // 원하는 케이지 중심 좌표
        const cx = 3.5;    
        const cz = -1;  
        const logoSize   = radius * 0.5;   // 로고가 차지할 대각 크기


        // — 텍스처 로더 & 세팅 —
        const loader       = new TextureLoader();
        // — 1) 체인링크 알파맵 로드 —
        const fenceAlpha = loader.load(
            'textures/cage_wall.jpg',
            );
        fenceAlpha.wrapS = fenceAlpha.wrapT = RepeatWrapping;
        fenceAlpha.repeat.set(segments, 1);
        // 2) 로고 맵 (투명 PNG 추천)
        const logoTex = loader.load('textures/ufc_logo.jpeg');
        logoTex.wrapS = logoTex.wrapT = RepeatWrapping;
        // 로고는 반복 필요 없으니 repeat.set(1,1)

        // — 1) 체인링크 케이지 벽 —
        const cageGeo = new THREE.CylinderGeometry(
            radius, radius, cageHeight, segments, 1, true
        );
        // 2) fenceMat 정의 — 알파맵과 alphaTest만으로 컷아웃 처리
        const fenceMat = new THREE.MeshStandardMaterial({
        color:       0x000000,     // 살아남을 선 색
        alphaMap:    fenceAlpha,  
        alphaTest:   0.5,          // 50% 미만 픽셀은 투명 컷아웃
        side:        THREE.DoubleSide,
        metalness:   0.6,
        roughness:   0.4
        });

        // 3) 알파맵 반전 (필요하다면)
        fenceMat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            'diffuseColor.a *= texture2D( alphaMap, vUv ).r;',
            'diffuseColor.a *= (1.0 - texture2D( alphaMap, vUv ).r);'
        );
        };
        

        const fenceMesh = new THREE.Mesh(cageGeo, fenceMat);
        fenceMesh.position.set(
            cx,
            yOffset + cageHeight/2 + thickness/2,
            cz
        );
        this.scene.add(fenceMesh);

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

    createWireframeButton() {
        const button = document.createElement('button');
        button.textContent = 'Wireframe Toggle';
        button.style.position = 'absolute';
        button.style.bottom = '80px';
        button.style.left = '20px';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#ffffff';
        button.style.border = '1px solid #cccccc';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';

        button.addEventListener('click', (event) => {
            event.stopPropagation(); // 버튼 클릭 시 씬 클릭 이벤트 방지
            this.isWireframe = !this.isWireframe;
            this.models.forEach(model => {
                model.traverse((child) => {
                    if (child.isMesh) {
                        child.material.wireframe = this.isWireframe;
                        if (this.isWireframe) {
                            // wireframe 모드일 때 정점 표시
                            const geometry = child.geometry;
                            const positions = geometry.attributes.position;
                            
                            // 기존 포인트 제거
                            child.children.forEach(point => {
                                if (point.isPoints) {
                                    child.remove(point);
                                }
                            });

                            // 새로운 포인트 생성
                            const pointGeometry = new THREE.BufferGeometry();
                            pointGeometry.setAttribute('position', positions);
                            
                            const pointMaterial = new THREE.PointsMaterial({
                                color: 0x000000,
                                size: 0.01,  // 크기를 0.15에서 0.05로 줄임
                                sizeAttenuation: true
                            });
                            
                            const points = new THREE.Points(pointGeometry, pointMaterial);
                            child.add(points);

                            // wireframe 선의 두께 조정
                            child.material.wireframeLinewidth = 1;
                        } else {
                            // wireframe 모드가 아닐 때 포인트 제거
                            child.children.forEach(point => {
                                if (point.isPoints) {
                                    child.remove(point);
                                }
                            });
                        }
                    }
                });
            });
        });

        this.container.appendChild(button);
        // 버튼 참조 저장
        if (!this.uiElements) this.uiElements = [];
        this.uiElements.push(button);
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
        button.textContent = 'Auto Rotate';
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
            button.textContent = this.autoRotate ? 'Auto Rotate' : 'Stop Rotate';
        });

        this.container.appendChild(button);
        // 버튼 참조 저장
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
        // 모델이 선택된 상태에서만 드래그 시작
        if (!this.selectedModel) return;
        // 마우스 왼쪽 버튼만
        if (event.button !== 0) return;
        
        // 버튼 위에서 드래그 시작한 경우 드래그 영역을 시각화하지 않음
        const target = event.target;
        if (target.tagName === 'BUTTON' || target.closest('button') || 
            target === this.rotateButton || target.closest('div[style*="position: absolute"]')) {
            return;
        }
        
        this.dragging = true;
        this.dragStart2D = { x: event.clientX, y: event.clientY };
        this.dragEnd2D = { x: event.clientX, y: event.clientY };
        
        // 드래그 시작 시 현재 마우스 위치 저장
        this.lastMouseX = event.clientX;
        this.lastMouseY = event.clientY;
        
        if (this.showDragBox) {
            this.updateDragBoxDiv();
            this.dragBoxDiv.style.display = 'block';
        }
    }

    handleDragMove(event) {
        if (!this.dragging || !this.selectedModel) return;
        
        // 현재 마우스 위치
        const currentX = event.clientX;
        const currentY = event.clientY;
        
        // 마우스 이동량 계산
        const deltaX = currentX - this.lastMouseX;
        const deltaY = currentY - this.lastMouseY;
        
        // 회전 속도 조절 (값이 클수록 더 빠르게 회전)
        const rotationSpeed = 0.005;
        
        // Y축 회전 (좌우)
        this.selectedModel.rotation.y += deltaX * rotationSpeed;
        
        // X축 회전 (상하) - 제한된 범위 내에서만 회전
        this.selectedModel.rotation.x += deltaY * rotationSpeed;
        this.selectedModel.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.selectedModel.rotation.x));
        
        // 다음 프레임을 위한 마우스 위치 업데이트
        this.lastMouseX = currentX;
        this.lastMouseY = currentY;
        
        if (this.showDragBox) {
            this.updateDragBoxDiv();
        }
    }

    handleDragEnd(event) {
        if (!this.dragging) return;
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
        // play 중이면 클릭 시 즉시 중단
        if (this.isPlaying) {
            this.isPlaying = false;
            this.showUI();
            this.playButton.textContent = 'Play';
            this.returnCameraToOriginalPosition();
            return;
        }
        // 마우스 위치를 정규화된 장치 좌표로 변환
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Raycaster 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 모델과의 교차 확인
        const intersects = this.raycaster.intersectObjects(this.models, true);

        // 모델 클릭 시
        if (intersects.length > 0) {
            const clicked = this.findParentModel(intersects[0].object);
            if (clicked && this.selectedModel !== clicked) {
                this.moveCameraToModel(clicked);
                this.showStats(clicked);
            }
            } else {
            // 빈 공간 클릭 시
            if (this.infoPanel) {
                this.scene.remove(this.infoPanel);
                this.infoPanel = null;
            }
            if (this.selectedModel) this.returnCameraToOriginalPosition();
            }
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
        const lines = [
            stats.Name,
            `HP:     ${stats.HP}`,
            `Attack: ${stats.Attack}`
        ];

        const colors = [
            0xffffff,  // Name → 흰색
            0xff0000,  // HP   → 빨간색
            0xff0000   // Attack → 빨간색
        ];
        // 4) Panel 그룹
        const panel = new THREE.Group();

        // 최대 폭 계산용 임시 bbox
        let maxWidth = 0;

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
            const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
            maxWidth = Math.max(maxWidth, w);

            const mat = new THREE.MeshBasicMaterial({ color: colors[i] });
            const mesh = new THREE.Mesh(geo, mat);

            // 각 줄 Y 오프셋: 첫 줄이 위
            const lineHeight = 0.3;
            mesh.position.y = - i * lineHeight;

            panel.add(mesh);
        });

        // 6) 그룹 전체 가운데 정렬: 왼쪽 정렬이 아니라, 텍스트 시작점이 왼쪽에 딱 붙도록
        panel.children.forEach(child => {
            // child.geometry.boundingBox 로 offset
            const bb = child.geometry.boundingBox;
            child.position.x = - maxWidth/2; 
        });

        // 7) 모델의 bounding box 이용해, panel 위치 잡기
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const leftX  = box.min.x;      // 모델의 가장 왼쪽
        const topY   = box.max.y;      // 모델의 가장 위

        // 살짝 왼쪽으로, 모델 높이 중앙에
        panel.position.set(
            leftX - 0.3,                  // 모델 옆으로 0.2m 만큼 더 왼쪽
            topY - 0.1,                   // 모델 위쪽에서 내려와서
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
        // 이전에 선택된 모델이 있다면 카메라를 원위치로
        if (this.selectedModel) {
            this.returnCameraToOriginalPosition();
        }

        // 선택된 모델 저장
        this.selectedModel = model;

        // 모델의 바운딩 박스 계산
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // 모델의 크기에 따라 카메라 거리 계산
        const maxDim = Math.max(size.x, size.y, size.z);
        const distance = maxDim * 1.5;

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

        // shapekey가 있는 모델(sahur)이 아닌 경우에만 점프 애니메이션 시작
        let hasShapekey = false;
        model.traverse((child) => {
            if (child.isMesh && child.morphTargetDictionary) {
                hasShapekey = true;
            }
        });

        if (!hasShapekey) {
            this.startJumpAnimation(model);
        }
    }

    startJumpAnimation(model) {
        this.isJumping = true;
        this.jumpStartTime = Date.now();

        const animateJump = () => {
            if (!this.isJumping) return;

            const currentTime = Date.now();
            const elapsedTime = currentTime - this.jumpStartTime;
            const progress = (elapsedTime % this.jumpDuration) / this.jumpDuration;

            // 사인 함수를 사용하여 부드러운 점프 애니메이션 구현
            const jumpProgress = Math.sin(progress * Math.PI);
            const originalY = this.originalPositions.get(model).y;
            model.position.y = originalY + (this.jumpHeight * jumpProgress);

            requestAnimationFrame(animateJump);
        };

        animateJump();
    }

    returnCameraToOriginalPosition() {
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

        // 모델 선택 해제
        this.selectedModel = null;

        // 컨트롤 다시 활성화
        this.controls.enabled = true;
    }

    loadModels() {
        const loader = new GLTFLoader();
        
        // 화면 배치 순서: banini, lirili, sahur, tra
        const modelPaths = [
            'models/banini.glb',
            'models/lirili.glb',
            'models/sahur_shapekey.glb',
            'models/tra.glb'
        ];
        const names = ['Banini', 'Lirili', 'Sahur', 'Tra'];

        modelPaths.forEach((path, index) => {
            loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;


                    model.userData.stats = {
                        Name:  names[index],
                        HP:    Math.floor( Math.random() * 200 ) + 50,   // 예시 수치
                        Attack: Math.floor( Math.random() * 100 ) + 20
                        };
                    model.userData.label = names[index];  // 클릭 시 표시할 텍스트
                    // 모델 위치 조정 (간격을 3으로 조정)

                    model.position.set(index * 3, 0, 0);
                    
                    this.modelInitialRotations.set(model, {
                        x: model.rotation.x,
                        y: model.rotation.y,
                        z: model.rotation.z
                    });
                    
                    model.traverse((child) => {
                        if (child.isMesh) {
                            if (child.material) {
                                child.material.needsUpdate = true;
                                child.material.metalness = 0.5;
                                child.material.roughness = 0.5;
                                child.material.envMapIntensity = 1.0;
                                
                                if (path === 'models/sahur_shapekey.glb' && child.morphTargetDictionary) {
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
                },
                (xhr) => {
                    console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                },
                (error) => {
                    console.error('An error happened', error);
                }
            );
        });
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
        const rotationDuration = 1500; // 1.5초 회전
        const moveDuration = 500; // 0.5초 이동
        const pauseDuration = 1250; // 1.25초 멈춤
        const zoomOutDuration = 500; // 0.5초 줌아웃
        const totalDuration = rotationDuration + (moveDuration + pauseDuration) * this.models.length + zoomOutDuration;
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

        // 카메라가 따라갈 모델 순서: sahur, tra, banini, lirili
        // models의 인덱스: banini(0), lirili(1), sahur(2), tra(3)
        const cameraModelOrder = [2, 3, 0, 1];
        // 각 모델별 카메라 위치 변화를 위한 배열 (순서 맞춰서)
        const cameraPositions = [
            { x: 0.0, y: 0.1, z: 1.5 },  // sahur
            { x: 0.3, y: 0.2, z: 1.0 },  // tra
            { x: 0.0, y: 0.2, z: 1.5 },  // banini
            { x: -0.4, y: 0.3, z: 1.3 }  // lirili
        ];

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
                if (elapsedTime < rotationDuration) {
                    // 초기 회전 단계
                    const rotationProgress = elapsedTime / rotationDuration;
                    const angle = startAngle + rotationProgress * Math.PI * 2;
                    currentPosition = new THREE.Vector3(
                        center.x + Math.cos(angle) * radius,
                        startPosition.y,
                        center.z + Math.sin(angle) * radius
                    );
                    currentTarget = center.clone();
                } else {
                    const remainingTime = elapsedTime - rotationDuration;
                    const modelDuration = moveDuration + pauseDuration;
                    const currentModelIndex = Math.floor(remainingTime / modelDuration);
                    if (currentModelIndex < cameraModelOrder.length) {
                        const modelProgress = (remainingTime % modelDuration) / moveDuration;
                        const modelIdx = cameraModelOrder[currentModelIndex];
                        if (modelProgress < 1) {
                            const easedProgress = modelProgress < 0.5
                                ? 4 * modelProgress * modelProgress * modelProgress
                                : 1 - Math.pow(-2 * modelProgress + 2, 3) / 2;
                            const model = this.models[modelIdx];
                            const box = new THREE.Box3().setFromObject(model);
                            const modelCenter = box.getCenter(new THREE.Vector3());
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);
                            let prevPosition;
                            if (currentModelIndex === 0) {
                                const rotationEndAngle = startAngle + Math.PI * 2;
                                prevPosition = new THREE.Vector3(
                                    center.x + Math.cos(rotationEndAngle) * radius,
                                    startPosition.y,
                                    center.z + Math.sin(rotationEndAngle) * radius
                                );
                            } else {
                                const prevModelIdx = cameraModelOrder[currentModelIndex - 1];
                                const prevModel = this.models[prevModelIdx];
                                const prevBox = new THREE.Box3().setFromObject(prevModel);
                                const prevCenter = prevBox.getCenter(new THREE.Vector3());
                                const prevPos = cameraPositions[currentModelIndex - 1];
                                prevPosition = new THREE.Vector3(
                                    prevCenter.x + prevPos.x,
                                    prevCenter.y + prevPos.y,
                                    prevCenter.z + prevPos.z
                                );
                            }
                            const targetPos = cameraPositions[currentModelIndex];
                            const targetPosition = new THREE.Vector3(
                                modelCenter.x + targetPos.x,
                                modelCenter.y + targetPos.y,
                                modelCenter.z + targetPos.z
                            );
                            currentPosition = new THREE.Vector3().lerpVectors(
                                prevPosition,
                                targetPosition,
                                easedProgress
                            );
                            currentTarget = new THREE.Vector3().lerpVectors(
                                currentModelIndex === 0 ? center : this.models[cameraModelOrder[currentModelIndex - 1]].position,
                                modelCenter,
                                easedProgress
                            );
                        } else {
                            const model = this.models[modelIdx];
                            const box = new THREE.Box3().setFromObject(model);
                            const modelCenter = box.getCenter(new THREE.Vector3());
                            const targetPos = cameraPositions[currentModelIndex];
                            currentPosition = new THREE.Vector3(
                                modelCenter.x + targetPos.x,
                                modelCenter.y + targetPos.y,
                                modelCenter.z + targetPos.z
                            );
                            currentTarget = modelCenter.clone();
                        }
                        if (currentModelIndex !== lastModelIndex) {
                            this.showStats(this.models[modelIdx]);
                            lastModelIndex = currentModelIndex;
                        }
                    } else {
                        // 마지막 줌아웃 단계
                        if (this.infoPanel) {
                            this.scene.remove(this.infoPanel);
                            this.infoPanel = null;
                        }
                        const zoomOutProgress = (elapsedTime - (rotationDuration + modelDuration * cameraModelOrder.length)) / zoomOutDuration;
                        const easedProgress = zoomOutProgress < 0.5
                            ? 4 * zoomOutProgress * zoomOutProgress * zoomOutProgress
                            : 1 - Math.pow(-2 * zoomOutProgress + 2, 3) / 2;
                        const lastModelIdx = cameraModelOrder[cameraModelOrder.length - 1];
                        const lastModel = this.models[lastModelIdx];
                        const box = new THREE.Box3().setFromObject(lastModel);
                        const modelCenter = box.getCenter(new THREE.Vector3());
                        const lastPos = cameraPositions[cameraModelOrder.length - 1];
                        const lastPosition = new THREE.Vector3(
                            modelCenter.x + lastPos.x,
                            modelCenter.y + lastPos.y,
                            modelCenter.z + lastPos.z
                        );
                        currentPosition = new THREE.Vector3().lerpVectors(
                            lastPosition,
                            startPosition,
                            easedProgress
                        );
                        currentTarget = new THREE.Vector3().lerpVectors(
                            modelCenter,
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

    setupMorphing(sourceMesh, targetMesh) {
        // 두 메쉬의 정점 수가 같은지 확인
        if (sourceMesh.geometry.attributes.position.count !== targetMesh.geometry.attributes.position.count) {
            console.error('메쉬의 정점 수가 일치하지 않습니다.');
            return;
        }

        // 소스 메쉬에 MorphTarget 추가
        sourceMesh.morphTargetDictionary = {};
        sourceMesh.morphTargetInfluences = [];

        // 타겟 메쉬의 위치를 MorphTarget으로 추가
        const positions = targetMesh.geometry.attributes.position.array;
        sourceMesh.morphTargetDictionary['target'] = 0;
        sourceMesh.morphTargetInfluences[0] = 0;

        // MorphTarget 생성
        const morphTarget = {
            name: 'target',
            vertices: new Float32Array(positions)
        };

        sourceMesh.geometry.morphTargets = [morphTarget];
        sourceMesh.material.morphTargets = true;

        // 모핑할 메쉬 저장
        this.morphingMeshes = [sourceMesh, targetMesh];
    }

    startMorphing() {
        if (this.morphingMeshes.length !== 2) return;
        
        this.isMorphing = true;
        this.morphingStartTime = Date.now();
        this.morphingProgress = 0;

        const animate = () => {
            if (!this.isMorphing) return;

            const currentTime = Date.now();
            const elapsedTime = currentTime - this.morphingStartTime;
            this.morphingProgress = Math.min(elapsedTime / this.morphingDuration, 1);

            // 부드러운 이징 함수 적용
            const easedProgress = this.morphingProgress < 0.5
                ? 4 * this.morphingProgress * this.morphingProgress * this.morphingProgress
                : 1 - Math.pow(-2 * this.morphingProgress + 2, 3) / 2;

            // MorphTarget 영향도 업데이트
            this.morphingMeshes[0].morphTargetInfluences[0] = easedProgress;

            if (this.morphingProgress < 1) {
                requestAnimationFrame(animate);
            } else {
                this.isMorphing = false;
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
        if (this.infoDiv) this.infoDiv.style.display = 'none';
    }
    showUI() {
        if (!this.uiElements) return;
        this.uiElements.forEach(el => {
            if (el && el.tagName === 'BUTTON') el.style.display = 'block';
        });
        if (this.infoDiv) this.infoDiv.style.display = 'block';
    }
}

// 씬 초기화
new Scene(); 