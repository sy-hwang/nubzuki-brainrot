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
        this.dragging = false;
        this.dragStart2D = { x: 0, y: 0 };
        this.dragEnd2D = { x: 0, y: 0 };
        this.dragBoxDiv = null;
        this.selectedVertices = new Set();
        this.vertexCountDisplay = null;
        this.fixedVertices = new Set();
        this.draggableVertices = new Set();
        this.isDraggable = false;
        this.isDeforming = false;
        this.currentMode = null;
        this.modeBorderDiv = null;
        
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

        // 드래그 박스용 div 생성
        this.createDragBoxDiv();
        // 마우스 드래그 이벤트 리스너 추가
        this.container.addEventListener('mousedown', (e) => this.handleDragStart(e));
        window.addEventListener('mousemove', (e) => this.handleDragMove(e));
        window.addEventListener('mouseup', (e) => this.handleDragEnd(e));

        // 선택된 정점 개수 표시 요소 생성
        this.createVertexCountDisplay();

        // GLB 파일 로드
        this.loadModels();

        // 버튼들 생성
        this.createActionButtons();

        // 모드 테두리 div 생성
        this.createModeBorderDiv();

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
            event.stopPropagation();
            this.returnCameraToOriginalPosition();
        });
        
        this.container.appendChild(button);
    }

    createRotateButton() {
        this.rotateButton = document.createElement('div');
        this.rotateButton.style.position = 'absolute';
        this.rotateButton.style.bottom = '20px';
        this.rotateButton.style.right = '20px';
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
        button.style.right = '20px';
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

    createVertexCountDisplay() {
        this.vertexCountDisplay = document.createElement('div');
        this.vertexCountDisplay.style.position = 'absolute';
        this.vertexCountDisplay.style.top = '20px';
        this.vertexCountDisplay.style.right = '20px';
        this.vertexCountDisplay.style.padding = '10px 20px';
        this.vertexCountDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
        this.vertexCountDisplay.style.border = '1px solid #cccccc';
        this.vertexCountDisplay.style.borderRadius = '5px';
        this.vertexCountDisplay.style.fontSize = '14px';
        this.vertexCountDisplay.style.zIndex = '1000';
        this.updateVertexCountDisplay();
        this.container.appendChild(this.vertexCountDisplay);
    }

    updateVertexCountDisplay() {
        if (this.vertexCountDisplay) {
            const fixedCount = this.fixedVertices.size;
            const draggableCount = this.draggableVertices.size;
            this.vertexCountDisplay.innerHTML = `
                <div style="color: #4CAF50;">Fixed vertices: ${fixedCount}</div>
                <div style="color: #f44336;">Draggable vertices: ${draggableCount}</div>
            `;
        }
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

        // fixed, draggable, deselect 모드에서만 드래그 영역 표시
        if (this.currentMode === 'fixed' || this.currentMode === 'draggable' || this.currentMode === 'deselect') {
            this.dragging = true;
            this.dragStart2D = { x: event.clientX, y: event.clientY };
            this.dragEnd2D = { x: event.clientX, y: event.clientY };
            this.updateDragBoxDiv();
            this.dragBoxDiv.style.display = 'block';
        }
    }

    handleDragMove(event) {
        if (!this.dragging) return;
        this.dragEnd2D = { x: event.clientX, y: event.clientY };
        this.updateDragBoxDiv();
    }

    handleDragEnd(event) {
        if (!this.dragging) return;
        this.dragging = false;
        this.dragBoxDiv.style.display = 'none';

        // 드래그 영역 안의 정점들을 선택
        if (this.selectedModel && (this.currentMode === 'fixed' || this.currentMode === 'draggable')) {
            const dragBox = {
                minX: Math.min(this.dragStart2D.x, this.dragEnd2D.x),
                maxX: Math.max(this.dragStart2D.x, this.dragEnd2D.x),
                minY: Math.min(this.dragStart2D.y, this.dragEnd2D.y),
                maxY: Math.max(this.dragStart2D.y, this.dragEnd2D.y)
            };

            // 이전 선택 초기화
            if (this.currentMode === 'fixed') {
                this.fixedVertices.clear();
            } else if (this.currentMode === 'draggable') {
                this.draggableVertices.clear();
            }

            this.selectedModel.traverse((child) => {
                if (child.isMesh && child.material.isShaderMaterial) {
                    const geometry = child.geometry;
                    const positions = geometry.attributes.position;
                    const selectedAttr = geometry.attributes.selected;

                    // 월드 변환 행렬 계산
                    const worldMatrix = child.matrixWorld;
                    const viewMatrix = this.camera.matrixWorldInverse;
                    const projectionMatrix = this.camera.projectionMatrix;
                    const viewProjectionMatrix = new THREE.Matrix4().multiplyMatrices(projectionMatrix, viewMatrix);

                    // 모든 정점을 2D로 투영
                    for (let i = 0; i < positions.count; i++) {
                        const vertex = new THREE.Vector3();
                        vertex.fromBufferAttribute(positions, i);
                        
                        // 월드 좌표로 변환
                        vertex.applyMatrix4(worldMatrix);
                        
                        // 뷰-투영 행렬 적용
                        const projected = vertex.clone().applyMatrix4(viewProjectionMatrix);
                        
                        // 정규화된 좌표를 화면 좌표로 변환
                        const x = (projected.x * 0.5 + 0.5) * window.innerWidth;
                        const y = (-projected.y * 0.5 + 0.5) * window.innerHeight;

                        // 드래그 영역 안에 있는 정점 선택
                        if (x >= dragBox.minX && x <= dragBox.maxX &&
                            y >= dragBox.minY && y <= dragBox.maxY) {
                            if (this.currentMode === 'fixed') {
                                this.fixedVertices.add(vertex);
                                selectedAttr.setX(i, 1);
                            } else if (this.currentMode === 'draggable') {
                                this.draggableVertices.add(vertex);
                                selectedAttr.setX(i, 2);
                            }
                        }
                    }
                    selectedAttr.needsUpdate = true;
                }
            });

            // 선택된 정점 개수 표시 업데이트
            this.updateVertexCountDisplay();
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

        // 현재 모드에 따라 드래그 박스 색상 변경
        if (this.currentMode === 'fixed') {
            this.dragBoxDiv.style.border = '2px solid #4CAF50';
            this.dragBoxDiv.style.background = 'rgba(76, 175, 80, 0.15)';
        } else if (this.currentMode === 'draggable') {
            this.dragBoxDiv.style.border = '2px solid #f44336';
            this.dragBoxDiv.style.background = 'rgba(244, 67, 54, 0.15)';
        } else if (this.currentMode === 'deselect') {
            this.dragBoxDiv.style.border = '2px solid #2196F3';
            this.dragBoxDiv.style.background = 'rgba(33, 150, 243, 0.15)';
        }
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

        // 액션 버튼들 활성화
        this.updateActionButtonsState();
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

        // 액션 버튼들 비활성화
        this.updateActionButtonsState();

        // 선택된 정점들 해제
        this.selectedVertices.clear();
        this.fixedVertices.clear();
        this.draggableVertices.clear();
        this.models.forEach(model => {
            model.traverse((child) => {
                if (child.isMesh && child.material.isShaderMaterial) {
                    const selectedAttr = child.geometry.attributes.selected;
                    const fixedAttr = child.geometry.attributes.fixed;
                    const draggableAttr = child.geometry.attributes.draggable;
                    if (selectedAttr) {
                        for (let i = 0; i < selectedAttr.count; i++) {
                            selectedAttr.setX(i, 0);
                        }
                        selectedAttr.needsUpdate = true;
                    }
                    if (fixedAttr) {
                        for (let i = 0; i < fixedAttr.count; i++) {
                            fixedAttr.setX(i, 0);
                        }
                        fixedAttr.needsUpdate = true;
                    }
                    if (draggableAttr) {
                        for (let i = 0; i < draggableAttr.count; i++) {
                            draggableAttr.setX(i, 0);
                        }
                        draggableAttr.needsUpdate = true;
                    }
                }
            });
        });

        // 선택된 정점 개수 표시 업데이트
        this.updateVertexCountDisplay();
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
                    model.position.set(index * 3, 0, 0);
                    
                    model.traverse((child) => {
                        if (child.isMesh) {
                            if (child.material) {
                                // 버텍스 셰이더에 선택 상태를 위한 attribute 추가
                                const geometry = child.geometry;
                                const vertexCount = geometry.attributes.position.count;
                                const selectedArray = new Float32Array(vertexCount).fill(0);
                                geometry.setAttribute('selected', new THREE.BufferAttribute(selectedArray, 1));

                                // 원래 재질의 속성 저장
                                const originalMaterial = child.material;
                                const originalColor = originalMaterial.color.clone();
                                const originalMetalness = originalMaterial.metalness;
                                const originalRoughness = originalMaterial.roughness;
                                const originalEnvMapIntensity = originalMaterial.envMapIntensity;

                                // 모델별 색상 밝기 조정
                                if (index === 0 || index === 2) {
                                    originalColor.multiplyScalar(1.5); // 1번과 3번 모델
                                } else {
                                    originalColor.multiplyScalar(2.0); // 2번과 4번 모델
                                }

                                // 커스텀 셰이더 머티리얼 생성
                                const material = new THREE.ShaderMaterial({
                                    uniforms: {
                                        color: { value: originalColor },
                                        fixedColor: { value: new THREE.Color(0x4CAF50) },
                                        draggableColor: { value: new THREE.Color(0xf44336) },
                                        map: { value: originalMaterial.map },
                                        normalMap: { value: originalMaterial.normalMap },
                                        roughnessMap: { value: originalMaterial.roughnessMap },
                                        metalnessMap: { value: originalMaterial.metalnessMap },
                                        aoMap: { value: originalMaterial.aoMap }
                                    },
                                    vertexShader: `
                                        attribute float selected;
                                        varying float vSelected;
                                        varying vec2 vUv;
                                        void main() {
                                            vSelected = selected;
                                            vUv = uv;
                                            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                                        }
                                    `,
                                    fragmentShader: `
                                        uniform vec3 color;
                                        uniform vec3 fixedColor;
                                        uniform vec3 draggableColor;
                                        uniform sampler2D map;
                                        uniform sampler2D normalMap;
                                        uniform sampler2D roughnessMap;
                                        uniform sampler2D metalnessMap;
                                        uniform sampler2D aoMap;
                                        varying float vSelected;
                                        varying vec2 vUv;

                                        void main() {
                                            vec4 texColor = texture2D(map, vUv);
                                            vec3 finalColor = texColor.rgb * color;
                                            
                                            if (vSelected > 1.5) { // draggable
                                                finalColor = mix(finalColor, draggableColor, 0.5);
                                            } else if (vSelected > 0.5) { // fixed
                                                finalColor = mix(finalColor, fixedColor, 0.5);
                                            }
                                            
                                            gl_FragColor = vec4(finalColor, texColor.a);
                                        }
                                    `,
                                    metalness: originalMetalness,
                                    roughness: originalRoughness,
                                    envMapIntensity: originalEnvMapIntensity,
                                    map: originalMaterial.map,
                                    normalMap: originalMaterial.normalMap,
                                    roughnessMap: originalMaterial.roughnessMap,
                                    metalnessMap: originalMaterial.metalnessMap,
                                    aoMap: originalMaterial.aoMap,
                                    transparent: originalMaterial.transparent,
                                    side: originalMaterial.side
                                });

                                child.material = material;
                                child.material.needsUpdate = true;
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

    createActionButtons() {
        const buttonContainer = document.createElement('div');
        buttonContainer.style.position = 'absolute';
        buttonContainer.style.bottom = '20px';
        buttonContainer.style.left = '20px';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.flexDirection = 'column';
        buttonContainer.style.gap = '10px';
        buttonContainer.style.zIndex = '1000';
        buttonContainer.style.marginBottom = '140px';

        const buttons = [
            { text: 'Fixed', color: '#4CAF50', mode: 'fixed', action: () => this.fixSelectedVertices() },
            { text: 'Draggable', color: '#f44336', mode: 'draggable', action: () => this.toggleDraggable() },
            { text: 'De-select', color: '#2196F3', mode: 'deselect', action: () => this.deselectVertices() },
            { text: 'Deform', color: '#ffffff', mode: 'deform', action: () => this.toggleDeform() }
        ];

        this.actionButtons = buttons.map(({ text, color, mode, action }) => {
            const button = document.createElement('button');
            button.textContent = text;
            button.style.padding = '10px 20px';
            button.style.backgroundColor = color;
            button.style.color = color === '#ffffff' ? '#000000' : '#ffffff';
            button.style.border = 'none';
            button.style.borderRadius = '5px';
            button.style.cursor = 'not-allowed';
            button.style.fontWeight = 'bold';
            button.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
            button.style.transition = 'all 0.3s ease';
            button.style.opacity = '0.5';
            button.dataset.mode = mode;

            button.addEventListener('mouseover', () => {
                if (button.style.cursor !== 'not-allowed') {
                    button.style.transform = 'scale(1.05)';
                }
            });

            button.addEventListener('mouseout', () => {
                button.style.transform = 'scale(1)';
            });

            button.addEventListener('click', (event) => {
                event.stopPropagation();
                if (button.style.cursor !== 'not-allowed') {
                    this.setMode(mode);
                    action();
                }
            });

            buttonContainer.appendChild(button);
            return button;
        });

        this.container.appendChild(buttonContainer);
    }

    createModeBorderDiv() {
        this.modeBorderDiv = document.createElement('div');
        this.modeBorderDiv.style.position = 'fixed';
        this.modeBorderDiv.style.top = '0';
        this.modeBorderDiv.style.left = '0';
        this.modeBorderDiv.style.right = '0';
        this.modeBorderDiv.style.bottom = '0';
        this.modeBorderDiv.style.pointerEvents = 'none';
        this.modeBorderDiv.style.border = 'none';
        this.modeBorderDiv.style.transition = 'border 0.3s ease';
        this.modeBorderDiv.style.zIndex = '9999';
        document.body.appendChild(this.modeBorderDiv);
    }

    setMode(mode) {
        // 이전 모드 버튼의 테두리 제거
        if (this.currentMode) {
            const prevButton = this.actionButtons.find(btn => btn.dataset.mode === this.currentMode);
            if (prevButton) {
                prevButton.style.border = 'none';
            }
        }

        // 같은 모드를 다시 클릭한 경우 모드 해제
        if (this.currentMode === mode) {
            this.currentMode = null;
            this.isDraggable = false;
            this.isDeforming = false;
            this.modeBorderDiv.style.border = 'none';
            return;
        }

        // 새로운 모드 설정
        this.currentMode = mode;
        const newButton = this.actionButtons.find(btn => btn.dataset.mode === mode);
        if (newButton) {
            this.modeBorderDiv.style.border = `5px solid ${newButton.style.backgroundColor}`;
        }

        // 모드별 상태 초기화
        switch (mode) {
            case 'draggable':
                this.isDraggable = true;
                this.isDeforming = false;
                break;
            case 'deform':
                this.isDraggable = false;
                this.isDeforming = true;
                break;
            case 'fixed':
            case 'deselect':
                this.isDraggable = false;
                this.isDeforming = false;
                break;
        }
    }

    updateActionButtonsState() {
        const isModelSelected = this.selectedModel !== null;
        this.actionButtons.forEach(button => {
            if (isModelSelected) {
                button.style.cursor = 'pointer';
                button.style.opacity = '1';
            } else {
                button.style.cursor = 'not-allowed';
                button.style.opacity = '0.5';
            }
        });
        // 모델이 선택되지 않았을 때는 모든 모드 해제
        if (!isModelSelected) {
            this.currentMode = null;
            this.isDraggable = false;
            this.isDeforming = false;
            this.modeBorderDiv.style.border = 'none';
        }
    }

    fixSelectedVertices() {
        if (!this.selectedModel || this.selectedVertices.size === 0) return;

        this.selectedVertices.forEach(vertex => {
            this.fixedVertices.add(vertex);
        });

        // 고정된 정점을 시각적으로 표시 (예: 노란색으로 변경)
        this.selectedModel.traverse((child) => {
            if (child.isMesh && child.material.isShaderMaterial) {
                const geometry = child.geometry;
                const positions = geometry.attributes.position;
                const fixedAttr = geometry.attributes.fixed || new THREE.BufferAttribute(
                    new Float32Array(positions.count).fill(0),
                    1
                );
                geometry.setAttribute('fixed', fixedAttr);

                // 고정된 정점 표시
                this.selectedVertices.forEach(vertex => {
                    for (let i = 0; i < positions.count; i++) {
                        const pos = new THREE.Vector3();
                        pos.fromBufferAttribute(positions, i);
                        if (pos.distanceTo(vertex) < 0.001) {
                            fixedAttr.setX(i, 1);
                        }
                    }
                });
                fixedAttr.needsUpdate = true;
            }
        });
    }

    toggleDraggable() {
        this.isDraggable = !this.isDraggable;
        if (this.isDraggable) {
            this.isDeforming = false;
        }
    }

    deselectVertices() {
        this.selectedVertices.clear();
        this.selectedModel?.traverse((child) => {
            if (child.isMesh && child.material.isShaderMaterial) {
                const selectedAttr = child.geometry.attributes.selected;
                for (let i = 0; i < selectedAttr.count; i++) {
                    selectedAttr.setX(i, 0);
                }
                selectedAttr.needsUpdate = true;
            }
        });
        this.updateVertexCountDisplay();
    }

    toggleDeform() {
        this.isDeforming = !this.isDeforming;
        if (this.isDeforming) {
            this.isDraggable = false;
        }
    }

    // 셰이더 머티리얼 업데이트
    updateShaderMaterial(child) {
        if (child.material.isShaderMaterial) {
            const material = child.material;
            material.uniforms.fixedColor = { value: new THREE.Color(0x4CAF50) };
            material.uniforms.draggableColor = { value: new THREE.Color(0xf44336) };
            
            // 셰이더 코드 업데이트
            material.vertexShader = `
                attribute float selected;
                varying float vSelected;
                varying vec2 vUv;
                void main() {
                    vSelected = selected;
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `;
            
            material.fragmentShader = `
                uniform vec3 color;
                uniform vec3 fixedColor;
                uniform vec3 draggableColor;
                uniform sampler2D map;
                varying float vSelected;
                varying vec2 vUv;

                void main() {
                    vec4 texColor = texture2D(map, vUv);
                    vec3 finalColor = texColor.rgb * color;
                    
                    if (vSelected > 1.5) { // draggable
                        finalColor = mix(finalColor, draggableColor, 0.5);
                    } else if (vSelected > 0.5) { // fixed
                        finalColor = mix(finalColor, fixedColor, 0.5);
                    }
                    
                    gl_FragColor = vec4(finalColor, texColor.a);
                }
            `;
            
            material.needsUpdate = true;
        }
    }
}

// 씬 초기화
new Scene(); 