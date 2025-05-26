import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Scene {
    constructor() {
        this.container = document.querySelector('#scene-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.models = [];
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
        this.isRotating = false;
        this.rotateButton = null;
        this.isWireframe = false;
        
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

        // Reset Camera 버튼 추가
        this.createResetButton();
        // Rotate Object 버튼 추가
        this.createRotateButton();
        // Wireframe Toggle 버튼 추가
        this.createWireframeButton();

        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener('resize', () => this.onWindowResize());

        // 마우스 이벤트 리스너 추가
        this.container.addEventListener('click', (event) => this.onMouseClick(event));

        // GLB 파일 로드
        this.loadModels();

        // 애니메이션 시작
        this.animate();
    }

    createResetButton() {
        const button = document.createElement('button');
        button.textContent = 'Reset Camera';
        button.style.position = 'absolute';
        button.style.top = '20px';
        button.style.left = '20px';
        button.style.padding = '10px 20px';
        button.style.backgroundColor = '#ffffff';
        button.style.border = '1px solid #cccccc';
        button.style.borderRadius = '5px';
        button.style.cursor = 'pointer';
        button.style.zIndex = '1000';
        
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // 버튼 클릭 시 씬 클릭 이벤트 방지
            this.returnCameraToOriginalPosition();
        });
        
        this.container.appendChild(button);
    }

    createRotateButton() {
        this.rotateButton = document.createElement('div');
        this.rotateButton.style.position = 'absolute';
        this.rotateButton.style.bottom = '20px';
        this.rotateButton.style.left = '20px';
        this.rotateButton.style.width = '50px';
        this.rotateButton.style.height = '50px';
        this.rotateButton.style.backgroundColor = '#cccccc';
        this.rotateButton.style.border = '2px solid #999999';
        this.rotateButton.style.borderRadius = '50%';
        this.rotateButton.style.cursor = 'not-allowed';
        this.rotateButton.style.zIndex = '1000';
        this.rotateButton.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
        
        // rotate 텍스트 추가
        const text = document.createElement('div');
        text.textContent = 'rotate';
        text.style.position = 'absolute';
        text.style.top = '50%';
        text.style.left = '50%';
        text.style.transform = 'translate(-50%, -50%)';
        text.style.fontSize = '12px';
        text.style.color = '#666';
        text.style.fontWeight = 'bold';
        this.rotateButton.appendChild(text);
        
        let lastMouseX = 0;
        let lastMouseY = 0;
        let rotationSpeed = 0.01;

        // 버튼 활성화 함수
        const activateButton = () => {
            this.rotateButton.style.backgroundColor = '#ffffff';
            this.rotateButton.style.border = '2px solid #cccccc';
            this.rotateButton.style.cursor = 'pointer';
        };

        // 버튼 비활성화 함수
        const deactivateButton = () => {
            this.rotateButton.style.backgroundColor = '#cccccc';
            this.rotateButton.style.border = '2px solid #999999';
            this.rotateButton.style.cursor = 'not-allowed';
        };
        
        this.rotateButton.addEventListener('mousedown', (event) => {
            if (this.selectedModel) {
                this.isRotating = true;
                this.rotateButton.style.backgroundColor = '#e0e0e0';
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            }
        });

        document.addEventListener('mouseup', () => {
            if (this.isRotating) {
                this.isRotating = false;
                if (this.selectedModel) {
                    activateButton();
                } else {
                    deactivateButton();
                }
            }
        });

        document.addEventListener('mousemove', (event) => {
            if (this.isRotating && this.selectedModel) {
                const deltaX = event.clientX - lastMouseX;
                const deltaY = event.clientY - lastMouseY;
                
                this.selectedModel.rotation.y += deltaX * rotationSpeed;
                this.selectedModel.rotation.x += deltaY * rotationSpeed;
                
                this.selectedModel.rotation.x = Math.max(-Math.PI/2, Math.min(Math.PI/2, this.selectedModel.rotation.x));
                
                lastMouseX = event.clientX;
                lastMouseY = event.clientY;
            }
        });
        
        this.container.appendChild(this.rotateButton);
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
        }
        // else: 아무 동작도 하지 않음
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
            center.y,
            center.z + distance
        );

        this.controlsStartTarget.copy(this.controls.target);
        this.controlsEndTarget.copy(center);

        // 카메라 이동 시작
        this.isCameraMoving = true;
        this.cameraMoveStartTime = Date.now();

        // 모델 선택 시 컨트롤 비활성화
        this.controls.enabled = false;
        
        // Rotate 버튼 활성화
        this.rotateButton.style.backgroundColor = '#ffffff';
        this.rotateButton.style.border = '2px solid #cccccc';
        this.rotateButton.style.cursor = 'pointer';
    }

    returnCameraToOriginalPosition() {
        // 시작 위치와 목표 위치 설정
        this.camera.position.copy(this.originalCameraPosition);
        this.controls.target.copy(this.originalControlsTarget);
        this.controls.update();
        this.selectedModel = null;

        // 컨트롤 다시 활성화
        this.controls.enabled = true;
        
        // Rotate 버튼 비활성화
        if (this.rotateButton) {
            this.rotateButton.style.backgroundColor = '#cccccc';
            this.rotateButton.style.border = '2px solid #999999';
            this.rotateButton.style.cursor = 'not-allowed';
        }
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
}

// 씬 초기화
new Scene(); 