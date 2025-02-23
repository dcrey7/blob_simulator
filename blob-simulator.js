// Error handling
function showError(message) {
    const errorElement = document.getElementById('error-message');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    console.error(message);
}

// WebGL initialization
const canvas = document.getElementById('canvas');
let gl;

try {
    gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
        throw new Error('WebGL not supported');
    }
} catch (e) {
    showError('Failed to initialize WebGL: ' + e.message);
}

// Shader sources
const vertexShaderSource = `
    attribute vec2 position;
    void main() {
        gl_Position = vec4(position, 0.0, 1.0);
    }
`;

const fragmentShaderSource = `
    precision highp float;
    
    uniform float time;
    uniform vec2 resolution;
    uniform vec2 mouse;
    uniform bool mouseDown;
    uniform float amount;
    uniform float size;
    uniform float speed;
    uniform float viscosity;
    uniform float dissipation;
    uniform float colorValue;
    uniform float colorRange;

    vec3 hsv2rgb(vec3 c) {
        vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
        vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
        return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
    }

    float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
    }

    void main() {
        vec2 uv = gl_FragCoord.xy / resolution.xy;
        vec3 finalColor = vec3(0.0);
        float adjustedTime = time * speed;

        // Mouse interaction
        if (mouseDown) {
            float d = length(uv - mouse);
            float brightness = 1.0 / (d * (20.0 / size));
            vec3 mouseColor = hsv2rgb(vec3(colorValue, 1.0, 1.0));
            finalColor += mouseColor * brightness;
        }

        // Render blobs
        for(float i = 0.0; i < 10.0; i++) {
            if(i >= amount) break;

            // Dynamic blob position
            float offset = i * 0.1;
            vec2 blobPos = vec2(
                sin(adjustedTime * (1.0 + i * 0.5) + random(vec2(i, 0.0)) * 6.28) * 0.5 + 0.5,
                cos(adjustedTime * (1.0 + i * 0.7) + random(vec2(i, 1.0)) * 6.28) * 0.5 + 0.5
            );

            // Adjust for size and calculate distance
            float d = length(uv - blobPos) / size;
            
            // Apply viscosity and dissipation
            float brightness = 1.0 / (d * 20.0);
            brightness = pow(brightness, 1.0 + viscosity);
            brightness *= exp(-d * dissipation * 10.0);

            // Color calculation with range
            float hue = colorValue + i * colorRange / amount;
            vec3 blobColor = hsv2rgb(vec3(hue, 1.0, 1.0));

            // Add to final color
            finalColor += blobColor * brightness;
        }

        gl_FragColor = vec4(finalColor, 1.0);
    }
`;

// Create shader helper function
function createShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const error = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(`Shader compilation error: ${error}`);
    }
    return shader;
}

// Create and set up program
let program;
try {
    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error('Program link error: ' + gl.getProgramInfoLog(program));
    }

    gl.useProgram(program);
} catch (e) {
    showError('Shader setup error: ' + e.message);
}

// Create geometry
const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

// Set up attributes and uniforms
const position = gl.getAttribLocation(program, 'position');
gl.enableVertexAttribArray(position);
gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

const uniforms = {
    time: gl.getUniformLocation(program, 'time'),
    resolution: gl.getUniformLocation(program, 'resolution'),
    mouse: gl.getUniformLocation(program, 'mouse'),
    mouseDown: gl.getUniformLocation(program, 'mouseDown'),
    amount: gl.getUniformLocation(program, 'amount'),
    size: gl.getUniformLocation(program, 'size'),
    speed: gl.getUniformLocation(program, 'speed'),
    viscosity: gl.getUniformLocation(program, 'viscosity'),
    dissipation: gl.getUniformLocation(program, 'dissipation'),
    colorValue: gl.getUniformLocation(program, 'colorValue'),
    colorRange: gl.getUniformLocation(program, 'colorRange')
};

// Settings object
const settings = {
    amount: 5,
    size: 2.0,
    speed: 0.1,
    viscosity: 1.0,
    dissipation: 0.0,
    colorValue: 0.356,
    colorRange: 0.0
};

// Mouse state
const mouse = {
    x: 0.5,
    y: 0.5,
    down: false
};

// Bind controls
function bindControl(id, prop) {
    const input = document.getElementById(id);
    const value = document.getElementById(`${id}-value`);
    
    if (input) {
        input.value = settings[prop];
        if (value) value.textContent = settings[prop];
        
        input.addEventListener('input', () => {
            settings[prop] = parseFloat(input.value);
            if (value) value.textContent = input.value;
            if (prop === 'colorValue') updateColorPreview();
        });
    }
}

// Bind all controls
['amount', 'size', 'speed', 'viscosity', 'dissipation', 'color', 'range'].forEach(id => {
    bindControl(id, id === 'color' ? 'colorValue' : id === 'range' ? 'colorRange' : id);
});

// Mouse events
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) / rect.width;
    mouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
});

canvas.addEventListener('mousedown', () => {
    mouse.down = true;
});

canvas.addEventListener('mouseup', () => {
    mouse.down = false;
});

canvas.addEventListener('mouseleave', () => {
    mouse.down = false;
});

// Touch events
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    mouse.x = (touch.clientX - rect.left) / rect.width;
    mouse.y = 1.0 - (touch.clientY - rect.top) / rect.height;
}, { passive: false });

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    mouse.down = true;
}, { passive: false });

canvas.addEventListener('touchend', () => {
    mouse.down = false;
});

// Handle window resize
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}

window.addEventListener('resize', resize);
resize();

// Update color preview
function updateColorPreview() {
    const preview = document.getElementById('color-preview');
    if (preview) {
        preview.style.backgroundColor = `hsl(${settings.colorValue * 360}, 100%, 50%)`;
    }
}

// Animation loop
function render(time) {
    // Update uniforms
    gl.uniform1f(uniforms.time, time * 0.001);
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.mouse, mouse.x, mouse.y);
    gl.uniform1i(uniforms.mouseDown, mouse.down);
    gl.uniform1f(uniforms.amount, settings.amount);
    gl.uniform1f(uniforms.size, settings.size);
    gl.uniform1f(uniforms.speed, settings.speed);
    gl.uniform1f(uniforms.viscosity, settings.viscosity);
    gl.uniform1f(uniforms.dissipation, settings.dissipation);
    gl.uniform1f(uniforms.colorValue, settings.colorValue);
    gl.uniform1f(uniforms.colorRange, settings.colorRange);

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
}

// Initialize color preview and start animation
updateColorPreview();
requestAnimationFrame(render);