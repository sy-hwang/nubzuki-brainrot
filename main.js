import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js';

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

        // GLB 파일 로드
        this.loadModels();

        // 애니메이션 시작
        this.animate();
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
        // 마우스 위치를 정규화된 장치 좌표로 변환
        this.mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        this.mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        // Raycaster 업데이트
        this.raycaster.setFromCamera(this.mouse, this.camera);

        // 모델과의 교차 확인
        const intersects = this.raycaster.intersectObjects(this.models, true);

        if (intersects.length > 0) {
            const clickedModel = this.findParentModel(intersects[0].object);
            if (clickedModel) {
                // 이미 선택된 모델이면 아무 동작도 하지 않음
                if (this.selectedModel === clickedModel) return;
                this.moveCameraToModel(clickedModel);
            }
        } else {
            // 모델이 아닌 부분을 클릭했을 때
            if (this.selectedModel) {
                this.returnCameraToOriginalPosition();
            }
        }
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
            center.y + this.jumpHeight, // 점프 높이만큼 카메라 위치를 위로 조정
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

        // 점프 애니메이션 시작
        this.startJumpAnimation(model);
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
        
        const modelPaths = [
            'models/banini.glb',
            'models/lirili.glb',
            'models/sahur.glb',
            'models/tra.glb'
        ];

        modelPaths.forEach((path, index) => {
            loader.load(
                path,
                (gltf) => {
                    const model = gltf.scene;
                    // 모델 위치 조정 (간격을 3으로 조정)
                    model.position.set(index * 3, 0, 0);
                    
                    // 모델의 초기 회전값 저장
                    this.modelInitialRotations.set(model, {
                        x: model.rotation.x,
                        y: model.rotation.y,
                        z: model.rotation.z
                    });
                    
                    // 모델의 모든 메시에 대해 재질 설정
                    model.traverse((child) => {
                        if (child.isMesh) {
                            // 재질이 있다면 설정
                            if (child.material) {
                                child.material.needsUpdate = true;
                                // 재질의 기본 설정
                                child.material.metalness = 0.5;
                                child.material.roughness = 0.5;
                                child.material.envMapIntensity = 1.0;
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

        // 자동 회전 로직 수정
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
        this.renderer.render(this.scene, this.camera);
    }

    togglePlay() {
        this.isPlaying = !this.isPlaying;
        this.playButton.textContent = this.isPlaying ? 'Stop' : 'Play';
        
        if (this.isPlaying) {
            // 재생 시작 시 카메라 트라젝토리 시작
            this.startCameraTrajectory();
        } else {
            // 재생 중지 시 카메라를 원위치로
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

        // 현재 카메라 위치에서의 반지름과 각도 계산
        const dx = startPosition.x - center.x;
        const dz = startPosition.z - center.z;
        const radius = Math.sqrt(dx * dx + dz * dz);
        const startAngle = Math.atan2(dz, dx);

        // 각 모델별 카메라 위치 변화를 위한 배열
        const cameraPositions = [
            { x: 0.0, y: 0.1, z: 1.5 },  // 세 번째 모델: 아래에서 보기
            { x: 0.3, y: 0.2, z: 1.0 },    // 네 번째 모델: 오른쪽 위에서 보기
            { x: 0.0, y: 0.2, z: 1.5 },  // 첫 번째 모델: 왼쪽에서 보기
            { x: -0.4, y: 0.3, z: 1.3 }  // 두 번째 모델: 왼쪽 위에서 보기
        ];

        const animate = () => {
            if (!this.isPlaying) return;

            const currentTime = Date.now();
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / totalDuration, 1);

            if (progress < 1) {
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
                    
                    if (currentModelIndex < this.models.length) {
                        const modelProgress = (remainingTime % modelDuration) / moveDuration;
                        
                        if (modelProgress < 1) {
                            // 모델로 이동 단계
                            const easedProgress = modelProgress < 0.5
                                ? 4 * modelProgress * modelProgress * modelProgress
                                : 1 - Math.pow(-2 * modelProgress + 2, 3) / 2;

                            const model = this.models[currentModelIndex];
                            const box = new THREE.Box3().setFromObject(model);
                            const modelCenter = box.getCenter(new THREE.Vector3());
                            const size = box.getSize(new THREE.Vector3());
                            const maxDim = Math.max(size.x, size.y, size.z);

                            // 이전 모델의 위치 계산
                            let prevPosition;
                            if (currentModelIndex === 0) {
                                // 첫 번째 모델로 이동할 때는 회전이 끝난 위치에서 시작
                                const rotationEndAngle = startAngle + Math.PI * 2;
                                prevPosition = new THREE.Vector3(
                                    center.x + Math.cos(rotationEndAngle) * radius,
                                    startPosition.y,
                                    center.z + Math.sin(rotationEndAngle) * radius
                                );
                            } else {
                                // 이전 모델의 위치
                                const prevModel = this.models[currentModelIndex - 1];
                                const prevBox = new THREE.Box3().setFromObject(prevModel);
                                const prevCenter = prevBox.getCenter(new THREE.Vector3());
                                const prevPos = cameraPositions[currentModelIndex - 1];
                                prevPosition = new THREE.Vector3(
                                    prevCenter.x + prevPos.x,
                                    prevCenter.y + prevPos.y,
                                    prevCenter.z + prevPos.z
                                );
                            }

                            // 현재 모델의 목표 위치
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
                                currentModelIndex === 0 ? center : this.models[currentModelIndex - 1].position,
                                modelCenter,
                                easedProgress
                            );
                        } else {
                            // 멈춤 단계
                            const model = this.models[currentModelIndex];
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
                    } else {
                        // 마지막 줌아웃 단계
                        const zoomOutProgress = (elapsedTime - (rotationDuration + modelDuration * this.models.length)) / zoomOutDuration;
                        const easedProgress = zoomOutProgress < 0.5
                            ? 4 * zoomOutProgress * zoomOutProgress * zoomOutProgress
                            : 1 - Math.pow(-2 * zoomOutProgress + 2, 3) / 2;

                        const lastModel = this.models[this.models.length - 1];
                        const box = new THREE.Box3().setFromObject(lastModel);
                        const modelCenter = box.getCenter(new THREE.Vector3());
                        const lastPos = cameraPositions[this.models.length - 1];

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
                // 애니메이션 완료 후 원래 위치로 복귀
                this.camera.position.copy(startPosition);
                this.controls.target.copy(startTarget);
                this.controls.update();
                this.isPlaying = false;
                this.playButton.textContent = 'Play';
            }
        };

        animate();
    }
}

// 씬 초기화
new Scene(); 