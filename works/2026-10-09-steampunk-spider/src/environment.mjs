import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

/** Surface detail and atmosphere only; the course geometry stays authoritative. */
export function createIndustrialEnvironment({
  THREE,
  scene,
  renderer,
  ground,
  wallGroup,
  obstacleGroup,
}) {
  let randomState = 0x51a7c0de;
  function random() {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  }

  const textureSize = 512;
  const coarseSize = 33;
  const coarse = Float32Array.from({ length: coarseSize * coarseSize }, random);
  const concretePixels = new Uint8Array(textureSize * textureSize * 4);
  const roughnessPixels = new Uint8Array(concretePixels.length);
  const bumpPixels = new Uint8Array(concretePixels.length);
  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      const gridX = (x / textureSize) * 32,
        gridY = (y / textureSize) * 32;
      const ix = Math.floor(gridX),
        iy = Math.floor(gridY);
      const fx = gridX - ix,
        fy = gridY - iy;
      const smoothX = fx * fx * (3 - 2 * fx),
        smoothY = fy * fy * (3 - 2 * fy);
      const top = THREE.MathUtils.lerp(
        coarse[iy * coarseSize + ix],
        coarse[iy * coarseSize + ix + 1],
        smoothX,
      );
      const bottom = THREE.MathUtils.lerp(
        coarse[(iy + 1) * coarseSize + ix],
        coarse[(iy + 1) * coarseSize + ix + 1],
        smoothX,
      );
      const grime = THREE.MathUtils.lerp(top, bottom, smoothY);
      const grit = random();
      const color = Math.round(178 + grime * 9 + (grit - 0.5) * 4);
      const roughness = Math.round(210 + grime * 35);
      const height = Math.round(105 + grit * 35 + grime * 25);
      const offset = (y * textureSize + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        concretePixels[offset + channel] = color;
        roughnessPixels[offset + channel] = roughness;
        bumpPixels[offset + channel] = height;
      }
      concretePixels[offset + 3] =
        roughnessPixels[offset + 3] =
        bumpPixels[offset + 3] =
          255;
    }
  }
  function repeatingTexture(pixels, colorSpace = THREE.NoColorSpace) {
    const texture = new THREE.DataTexture(
      pixels,
      textureSize,
      textureSize,
      THREE.RGBAFormat,
    );
    texture.colorSpace = colorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(12, 12);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
    texture.needsUpdate = true;
    return texture;
  }
  ground.material.map = repeatingTexture(concretePixels, THREE.SRGBColorSpace);
  ground.material.roughnessMap = repeatingTexture(roughnessPixels);
  ground.material.bumpMap = repeatingTexture(bumpPixels);
  ground.material.bumpScale = 0.018;
  ground.material.color.set("#252b33");
  ground.material.roughness = 1;
  ground.material.needsUpdate = true;

  const room = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const reflections = pmrem.fromScene(room, 0.06, 0.1, 100, { size: 128 });
  scene.environment = reflections.texture;
  scene.environmentIntensity = 0.1;
  room.dispose();
  pmrem.dispose();
  scene.fog = new THREE.FogExp2(
    scene.background?.isColor ? scene.background : "#080d14",
    0.04,
  );

  const treatedMaterials = new Set();
  function addSurfaceDetail(material, worldSpace) {
    if (
      treatedMaterials.has(material) ||
      !(material.isMeshStandardMaterial || material.isMeshPhysicalMaterial)
    )
      return;
    if (material.emissive?.getHex() !== 0) return;
    treatedMaterials.add(material);
    const previousCompile = material.onBeforeCompile;
    const previousKey = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader, activeRenderer) => {
      previousCompile.call(material, shader, activeRenderer);
      shader.vertexShader =
        "varying vec3 vIndustrialSurface;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        `#include <project_vertex>
        vIndustrialSurface = ${worldSpace ? "(modelMatrix * vec4(transformed, 1.0)).xyz" : "transformed"};`,
      );
      shader.fragmentShader =
        "varying vec3 vIndustrialSurface;\n" + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `#include <roughnessmap_fragment>
        float industrialGrain = sin(dot(vIndustrialSurface, vec3(19.0, 31.0, 23.0))) * 0.5
          + sin(dot(vIndustrialSurface, vec3(67.0, 53.0, 79.0))) * 0.25;
        roughnessFactor = clamp(roughnessFactor + industrialGrain * ${worldSpace ? "0.025" : "0.035"}, 0.32, 1.0);`,
      );
      if (worldSpace)
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <color_fragment>",
          `#include <color_fragment>
        float industrialStreak = sin(vIndustrialSurface.y * 7.0 + sin(vIndustrialSurface.x * 3.0));
        diffuseColor.rgb *= 0.97 + industrialStreak * 0.015;`,
        );
    };
    material.customProgramCacheKey = () =>
      `${previousKey()}-industrial-${worldSpace ? "world" : "local"}`;
    material.roughness = Math.max(material.roughness, 0.42);
    material.envMapIntensity = 1;
    material.needsUpdate = true;
  }
  function applyToMeshes(object, worldSpace) {
    object.traverse((node) => {
      if (!node.isMesh) return;
      for (const material of Array.isArray(node.material)
        ? node.material
        : [node.material])
        addSurfaceDetail(material, worldSpace);
    });
  }
  applyToMeshes(wallGroup, true);
  applyToMeshes(obstacleGroup, true);

  // Low ground clouds stay in world space during the climb and flight.
  const mistSize = 128;
  const mistPixels = new Uint8Array(mistSize * mistSize * 4);
  for (let y = 0; y < mistSize; y++) {
    for (let x = 0; x < mistSize; x++) {
      const nx = (x / (mistSize - 1) - 0.5) * 2;
      const ny = (y / (mistSize - 1) - 0.5) * 2;
      const edge = Math.max(Math.abs(nx), Math.abs(ny));
      const falloff =
        Math.exp(-(nx * nx + ny * ny * 1.4) * 2.5) * (1 - edge ** 2);
      const clouds = 0.8 + Math.sin(nx * 4 + ny * 2) * 0.1;
      const offset = (y * mistSize + x) * 4;
      mistPixels[offset] =
        mistPixels[offset + 1] =
        mistPixels[offset + 2] =
          255;
      mistPixels[offset + 3] = Math.round(Math.max(0, falloff * clouds) * 255);
    }
  }
  const mistTexture = new THREE.DataTexture(
    mistPixels,
    mistSize,
    mistSize,
    THREE.RGBAFormat,
  );
  mistTexture.magFilter = mistTexture.minFilter = THREE.LinearFilter;
  mistTexture.needsUpdate = true;
  const mistMaterial = new THREE.SpriteMaterial({
    map: mistTexture,
    color: "#62778f",
    opacity: 0.07,
    transparent: true,
    depthWrite: false,
    fog: true,
  });
  const mistClouds = Array.from({ length: 10 }, (_, index) => {
    const sprite = new THREE.Sprite(mistMaterial);
    const baseX = ((index % 3) - 1) * 3.7 + (random() - 0.5) * 1.1;
    const baseZ = -4.7 + index * 2.5;
    sprite.position.set(baseX, 0.25, baseZ);
    sprite.scale.set(4.5 + random() * 1.8, 0.42 + random() * 0.12, 1);
    sprite.name = `GroundMist_${index}`;
    scene.add(sprite);
    return { sprite, baseX, baseZ, phase: random() * Math.PI * 2 };
  });

  const ambientCount = 72,
    impactCount = 144,
    totalCount = ambientCount + impactCount;
  const positions = new Float32Array(totalCount * 3);
  const alpha = new Float32Array(totalCount);
  const sizes = new Float32Array(totalCount);
  const kinds = new Float32Array(totalCount);
  const seeds = Float32Array.from({ length: totalCount }, () => random());
  const basePositions = new Float32Array(ambientCount * 3);
  const dustVelocity = new Float32Array(impactCount * 3);
  const dustAge = new Float32Array(impactCount).fill(10);
  const dustLifetime = new Float32Array(impactCount);
  const dustBaseSize = new Float32Array(impactCount);
  for (let i = 0; i < ambientCount; i++) {
    basePositions[i * 3] = (random() - 0.5) * 18;
    basePositions[i * 3 + 1] = 0.3 + random() * 8;
    basePositions[i * 3 + 2] = -8 + random() * 26;
    alpha[i] = 0.12 + random() * 0.08;
    sizes[i] = 1.5 + random() * 1.7;
  }
  for (let i = ambientCount; i < totalCount; i++)
    kinds[i] = i % 4 === 0 ? 2 : 1;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    "particleAlpha",
    new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute("particleSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("particleKind", new THREE.BufferAttribute(kinds, 1));
  geometry.setAttribute("particleSeed", new THREE.BufferAttribute(seeds, 1));
  const dustMaterial = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        pixelRatio: { value: renderer.getPixelRatio() },
        viewportHeight: { value: 1080 },
        dustColor: { value: new THREE.Color("#817a70") },
      },
    ]),
    transparent: true,
    depthWrite: false,
    fog: true,
    vertexShader: `attribute float particleAlpha; attribute float particleSize; attribute float particleKind; attribute float particleSeed;
      uniform float pixelRatio; uniform float viewportHeight;
      varying float vParticleAlpha; varying float vParticleKind; varying float vParticleSeed;
      #include <fog_pars_vertex>
      void main(){vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
        gl_Position=projectionMatrix*mvPosition;
        gl_PointSize=particleKind<.5 ? particleSize*pixelRatio :
          clamp(particleSize*viewportHeight*projectionMatrix[1][1]/max(.5,-mvPosition.z),1.,110.);
        vParticleAlpha=particleAlpha;
        vParticleKind=particleKind; vParticleSeed=particleSeed;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 dustColor; varying float vParticleAlpha; varying float vParticleKind; varying float vParticleSeed;
      #include <fog_pars_fragment>
      float hash(vec2 coordinate){return fract(sin(dot(coordinate,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 coordinate){vec2 cell=floor(coordinate);vec2 blend=fract(coordinate);blend=blend*blend*(3.-2.*blend);
        return mix(mix(hash(cell),hash(cell+vec2(1,0)),blend.x),mix(hash(cell+vec2(0,1)),hash(cell+vec2(1,1)),blend.x),blend.y);}
      void main(){vec2 center=gl_PointCoord-0.5;
        float softness=pow(max(0.0,1.0-dot(center,center)*4.0),2.0);
        vec3 tint=vec3(.48,.54,.60);
        if(vParticleKind>.5){
          vec2 textureUv=gl_PointCoord*5.+vParticleSeed*29.;
          float detail=noise(textureUv)*.6+noise(textureUv*2.1)*.3+noise(textureUv*4.3)*.1;
          softness*=smoothstep(.22,.7,detail);
          tint=dustColor*(.7+.3*gl_PointCoord.y);
          if(vParticleKind>1.5)softness=1.-smoothstep(.1,.25,length(center));
        }
        gl_FragColor=vec4(tint,vParticleAlpha*softness);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const dust = new THREE.Points(geometry, dustMaterial);
  const viewportSize = new THREE.Vector2();
  dust.onBeforeRender = (activeRenderer) => {
    const target = activeRenderer.getRenderTarget();
    activeRenderer.getSize(viewportSize);
    // Low-resolution capture uses the same apparent mote size as the smooth panel.
    dustMaterial.uniforms.pixelRatio.value = target
      ? target.height / viewportSize.y
      : activeRenderer.getPixelRatio();
    dustMaterial.uniforms.viewportHeight.value = target
      ? target.height
      : viewportSize.y * activeRenderer.getPixelRatio();
  };
  // The particle pool moves across the entire course, including the far-side landing.
  dust.frustumCulled = false;
  dust.name = "IndustrialDust";
  scene.add(dust);
  let previousImpact = false;
  function update(
    time,
    dt,
    spiderPosition,
    landingImpact = false,
    contactPoints = [],
  ) {
    for (const cloud of mistClouds) {
      cloud.sprite.position.x =
        cloud.baseX + Math.sin(time * 0.08 + cloud.phase) * 0.45;
      cloud.sprite.position.z =
        cloud.baseZ + Math.sin(time * 0.055 + cloud.phase) * 0.3;
      cloud.sprite.position.y =
        0.25 + Math.sin(time * 0.1 + cloud.phase) * 0.025;
    }
    const impact = Boolean(landingImpact);
    if (impact && !previousImpact && spiderPosition.y < 0.4) {
      for (let i = 0; i < impactCount; i++) {
        const contact = contactPoints.length
          ? contactPoints[i % contactPoints.length]
          : spiderPosition;
        const outward = Math.atan2(
          contact.z - spiderPosition.z,
          contact.x - spiderPosition.x,
        );
        const angle = outward + (random() - 0.5) * 2.2;
        const radius = random() * 0.12;
        const index = (ambientCount + i) * 3;
        const grit = kinds[ambientCount + i] > 1.5;
        positions[index] = contact.x + Math.cos(angle) * radius;
        positions[index + 1] = 0.035;
        positions[index + 2] = contact.z + Math.sin(angle) * radius;
        const speed = 0.35 + random() * (grit ? 0.7 : 0.45);
        dustVelocity[i * 3] = Math.cos(angle) * speed;
        dustVelocity[i * 3 + 1] = grit
          ? 0.4 + random() * 0.5
          : 0.09 + random() * 0.11;
        dustVelocity[i * 3 + 2] = Math.sin(angle) * speed;
        dustAge[i] = -random() * 0.055;
        dustLifetime[i] = grit ? 0.4 + random() * 0.35 : 1.1 + random() * 0.85;
        dustBaseSize[i] = grit
          ? 0.012 + random() * 0.018
          : 0.15 + random() * 0.18;
      }
    }
    previousImpact = impact;
    for (let i = 0; i < ambientCount; i++) {
      positions[i * 3] =
        basePositions[i * 3] + Math.sin(time * 0.07 + i) * 0.35;
      positions[i * 3 + 1] =
        0.3 + ((basePositions[i * 3 + 1] + time * 0.035) % 8);
      positions[i * 3 + 2] =
        basePositions[i * 3 + 2] + Math.sin(time * 0.05 + i * 0.3) * 0.25;
    }
    for (let i = 0; i < impactCount; i++) {
      dustAge[i] += Math.max(0, dt);
      const index = (ambientCount + i) * 3;
      const age = dustAge[i];
      const life = dustLifetime[i];
      const grit = kinds[ambientCount + i] > 1.5;
      alpha[ambientCount + i] =
        age < 0 || age >= life
          ? 0
          : (grit ? 0.48 : 0.2) *
            Math.min(1, age / 0.035) *
            (1 - age / life) ** 1.6;
      if (age < 0 || age >= life) continue;
      sizes[ambientCount + i] = dustBaseSize[i] * (grit ? 1 : 1 + age * 1.2);
      positions[index] += dustVelocity[i * 3] * dt;
      positions[index + 1] += dustVelocity[i * 3 + 1] * dt;
      positions[index + 2] += dustVelocity[i * 3 + 2] * dt;
      dustVelocity[i * 3] *= Math.exp(-dt * 2.2);
      dustVelocity[i * 3 + 2] *= Math.exp(-dt * 2.2);
      dustVelocity[i * 3 + 1] -= (grit ? 5.5 : 0.22) * dt;
      if (positions[index + 1] < 0.02) {
        positions[index + 1] = 0.02;
        dustVelocity[i * 3 + 1] = grit
          ? Math.abs(dustVelocity[i * 3 + 1]) * 0.12
          : 0;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.particleAlpha.needsUpdate = true;
    geometry.attributes.particleSize.needsUpdate = true;
  }
  update(0, 0, new THREE.Vector3());
  return {
    update,
    applyModelMaterials: (model) => applyToMeshes(model, false),
  };
}
