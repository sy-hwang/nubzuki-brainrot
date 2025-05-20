import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

class Scene {
    constructor() {
        this.container = document.querySelector('#scene-container');
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.controls = null;
        this.models = [];
        
        this.init();
    }

    init() {
        // 렌더러 설정
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.container.appendChild(this.renderer.domElement);

        // 카메라 위치 설정
        this.camera.position.set(0, 5, 10);

        // 조명 설정
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(5, 5, 5);
        this.scene.add(directionalLight);

        // 컨트롤 설정
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;

        // 윈도우 리사이즈 이벤트 처리
        window.addEventListener('resize', () => this.onWindowResize());

        // GLB 파일 로드
        this.loadModels();

        // 애니메이션 시작
        this.animate();
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
                    // 모델 위치 조정
                    model.position.set(index * 2, 0, 0);
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

        // 모델 애니메이션 (필요한 경우)
        this.models.forEach(model => {
            model.rotation.y += 0.005;
        });

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}

// 씬 초기화
new Scene(); 