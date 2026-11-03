"use strict";

class SeatixRenderer {
    constructor(canvas, callbacks) {
        this.canvas = canvas;
        this.callbacks = callbacks;
        this.gl = canvas.getContext("webgl", { antialias: true, alpha: false });
        if (!this.gl) throw new Error("WebGL is not available in this browser.");

        this.camera = { yaw: 0.12, pitch: 0.39, distance: 39, target: [0, 1.9, 0] };
        this.seats = [];
        this.selectedIds = new Set();
        this.drag = null;
        this.lastPointer = [0, 0];
        this.program = this.createProgram();
        this.positionLocation = this.gl.getAttribLocation(this.program, "aPosition");
        this.normalLocation = this.gl.getAttribLocation(this.program, "aNormal");
        this.colorLocation = this.gl.getAttribLocation(this.program, "aColor");
        this.textureCoordinateLocation = this.gl.getAttribLocation(this.program, "aTextureCoordinate");
        this.screenLocation = this.gl.getAttribLocation(this.program, "aScreen");
        this.matrixLocation = this.gl.getUniformLocation(this.program, "uViewProjection");
        this.movieTextureLocation = this.gl.getUniformLocation(this.program, "uMovieTexture");
        this.positionBuffer = this.gl.createBuffer();
        this.normalBuffer = this.gl.createBuffer();
        this.colorBuffer = this.gl.createBuffer();
        this.textureCoordinateBuffer = this.gl.createBuffer();
        this.screenBuffer = this.gl.createBuffer();
        this.movieTexture = this.gl.createTexture();
        this.movie = null;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.movieTexture);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA,
            this.gl.UNSIGNED_BYTE, new Uint8Array([16, 19, 26, 255]));
        this.vertexCount = 0;
        this.viewportWidth = 0;
        this.viewportHeight = 0;

        this.installControls();
        this.resizeObserver = new ResizeObserver(() => this.draw());
        this.resizeObserver.observe(canvas);
        this.draw();
    }

    createProgram() {
        const gl = this.gl;
        const vertexShader = this.compileShader(gl.VERTEX_SHADER, `
            attribute vec3 aPosition;
            attribute vec3 aNormal;
            attribute vec3 aColor;
            attribute vec2 aTextureCoordinate;
            attribute float aScreen;
            uniform mat4 uViewProjection;
            varying vec3 vNormal;
            varying vec3 vColor;
            varying vec2 vTextureCoordinate;
            varying float vScreen;
            void main() {
                gl_Position = uViewProjection * vec4(aPosition, 1.0);
                vNormal = aNormal;
                vColor = aColor;
                vTextureCoordinate = aTextureCoordinate;
                vScreen = aScreen;
            }
        `);
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, `
            precision mediump float;
            varying vec3 vNormal;
            varying vec3 vColor;
            varying vec2 vTextureCoordinate;
            varying float vScreen;
            uniform sampler2D uMovieTexture;
            void main() {
                if (vScreen > 0.5) {
                    gl_FragColor = texture2D(uMovieTexture, vTextureCoordinate);
                    return;
                }
                vec3 lightDirection = normalize(vec3(-0.45, 0.86, 0.55));
                float diffuse = max(dot(normalize(vNormal), lightDirection), 0.0);
                float lighting = 0.52 + diffuse * 0.48;
                gl_FragColor = vec4(vColor * lighting, 1.0);
            }
        `);
        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(`Could not link the 3D renderer: ${gl.getProgramInfoLog(program)}`);
        }
        return program;
    }

    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const message = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error(`Could not compile the 3D renderer: ${message}`);
        }
        return shader;
    }

    setMovie(movie) {
        this.movie = movie;
        const image = new Image();
        image.onload = () => {
            if (this.movie === movie) this.drawMovieScreen(movie, image);
        };
        image.onerror = () => {
            if (this.movie === movie) {
                console.error(`Could not load the ${movie.title} poster for the auditorium screen.`);
                this.drawMovieScreen(movie, null);
            }
        };
        image.src = movie.poster;
    }

    drawMovieScreen(movie, image) {
        const screen = document.createElement("canvas");
        screen.width = 2048;
        screen.height = 200;
        const context = screen.getContext("2d");
        context.fillStyle = "#10131a";
        context.fillRect(0, 0, screen.width, screen.height);

        if (image) {
            const sourceRatio = image.naturalWidth / image.naturalHeight;
            const targetRatio = screen.width / screen.height;
            const sourceWidth = sourceRatio > targetRatio ? image.naturalHeight * targetRatio : image.naturalWidth;
            const sourceHeight = sourceRatio > targetRatio ? image.naturalHeight : image.naturalWidth / targetRatio;
            const sourceX = (image.naturalWidth - sourceWidth) / 2;
            const sourceY = (image.naturalHeight - sourceHeight) / 2;
            context.filter = "blur(18px)";
            context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, screen.width, screen.height);
            context.filter = "none";
        }

        const shade = context.createLinearGradient(0, 0, screen.width, 0);
        shade.addColorStop(0, "rgba(5, 7, 11, 0.88)");
        shade.addColorStop(0.68, "rgba(5, 7, 11, 0.58)");
        shade.addColorStop(1, "rgba(5, 7, 11, 0.36)");
        context.fillStyle = shade;
        context.fillRect(0, 0, screen.width, screen.height);
        if (image) {
            const posterHeight = 176;
            const posterWidth = posterHeight * image.naturalWidth / image.naturalHeight;
            const posterX = screen.width - posterWidth - 48;
            context.drawImage(image, posterX, 12, posterWidth, posterHeight);
        }
        context.fillStyle = "#c9f25a";
        context.font = "700 24px Segoe UI, Arial, sans-serif";
        context.fillText("SEATIX  ·  NOW SHOWING", 72, 48);
        context.fillStyle = "#ffffff";
        let titleSize = 66;
        context.font = `700 ${titleSize}px Segoe UI, Arial, sans-serif`;
        while (context.measureText(movie.title).width > 1250 && titleSize > 34) {
            titleSize -= 2;
            context.font = `700 ${titleSize}px Segoe UI, Arial, sans-serif`;
        }
        context.fillText(movie.title, 72, 126);
        context.fillStyle = "rgba(255, 255, 255, 0.78)";
        context.font = "500 20px Segoe UI, Arial, sans-serif";
        context.fillText("EXPERIENCE THE MOVIE IN 3D", 76, 166);

        const gl = this.gl;
        gl.bindTexture(gl.TEXTURE_2D, this.movieTexture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, screen);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        this.draw();
    }

    setSeats(seats) {
        this.seats = seats;
        this.selectedIds.clear();
        this.buildGeometry();
        this.draw();
    }

    setSelectedSeats(ids) {
        this.selectedIds = new Set(ids);
        this.buildGeometry();
        this.draw();
    }

    buildGeometry() {
        const positions = [];
        const normals = [];
        const colors = [];
        const textureCoordinates = [];
        const screenVertices = [];
        this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, -0.29, 1.2, 35, 0.58, 31, [0.105, 0.13, 0.17]);
        this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, 0.12, -12.1, 25, 0.38, 4.1, [0.18, 0.20, 0.25]);
        this.addCurvedScreen(positions, normals, colors, textureCoordinates, screenVertices);

        if (this.seats.some((seat) => seat.section === "Mezzanine")) {
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, 2.03, -0.9, 28, 0.32, 7.7, [0.15, 0.17, 0.22]);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, 2.25, 3.05, 28, 0.11, 0.18, [0.42, 0.46, 0.53]);
        }
        if (this.seats.some((seat) => seat.section === "Balcony")) {
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, 3.58, 1.2, 28, 0.32, 6.7, [0.17, 0.18, 0.23]);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, 0, 3.80, 4.65, 28, 0.11, 0.18, [0.42, 0.46, 0.53]);
        }

        for (const seat of this.seats) {
            const base = seat.unavailable ? [0.82, 0.24, 0.29]
                : this.selectedIds.has(seat.id) ? [1.0, 0.39, 0.13]
                    : seat.category === "premium" ? [0.96, 0.76, 0.22]
                        : [0.13, 0.76, 0.85];
            const back = base.map((value) => value * 0.79);
            const frame = [0.29, 0.33, 0.40];
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, seat.x, seat.y + 0.47, seat.z, 0.54, 0.15, 0.54, base);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, seat.x, seat.y + 0.86, seat.z + 0.20, 0.54, 0.66, 0.14, back);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, seat.x - 0.32, seat.y + 0.58, seat.z, 0.09, 0.20, 0.57, frame);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, seat.x + 0.32, seat.y + 0.58, seat.z, 0.09, 0.20, 0.57, frame);
            this.addBox(positions, normals, colors, textureCoordinates, screenVertices, seat.x, seat.y + 0.22, seat.z + 0.04, 0.15, 0.33, 0.15, frame);
        }

        this.vertexCount = positions.length / 3;
        this.uploadBuffer(this.positionBuffer, positions, this.positionLocation);
        this.uploadBuffer(this.normalBuffer, normals, this.normalLocation);
        this.uploadBuffer(this.colorBuffer, colors, this.colorLocation);
        this.uploadBuffer(this.textureCoordinateBuffer, textureCoordinates, this.textureCoordinateLocation, 2);
        this.uploadBuffer(this.screenBuffer, screenVertices, this.screenLocation, 1);
    }

    uploadBuffer(buffer, data, location, components = 3) {
        const gl = this.gl;
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
    }

    addCurvedScreen(positions, normals, colors, textureCoordinates, screenVertices) {
        const segments = 36;
        const radius = 30;
        const halfAngle = 0.42;
        const screenColor = [0.83, 0.89, 0.97];
        for (let index = 0; index < segments; index++) {
            const leftAngle = -halfAngle + 2 * halfAngle * index / segments;
            const rightAngle = -halfAngle + 2 * halfAngle * (index + 1) / segments;
            const point = (angle, y) => [radius * Math.sin(angle), y, -14.1 + radius * (1 - Math.cos(angle))];
            const bottomLeft = point(leftAngle, 3.75);
            const topLeft = point(leftAngle, 6.2);
            const bottomRight = point(rightAngle, 3.75);
            const topRight = point(rightAngle, 6.2);
            const left = index / segments;
            const right = (index + 1) / segments;
            this.addTriangle(positions, normals, colors, textureCoordinates, screenVertices,
                bottomLeft, bottomRight, topLeft, screenColor, [[left, 0], [right, 0], [left, 1]]);
            this.addTriangle(positions, normals, colors, textureCoordinates, screenVertices,
                bottomRight, topRight, topLeft, screenColor, [[right, 0], [right, 1], [left, 1]]);
        }
    }

    addBox(positions, normals, colors, textureCoordinates, screenVertices, x, y, z, width, height, depth, color) {
        const x0 = x - width / 2;
        const x1 = x + width / 2;
        const y0 = y - height / 2;
        const y1 = y + height / 2;
        const z0 = z - depth / 2;
        const z1 = z + depth / 2;
        const faces = [
            [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]],
            [[x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [x0, y0, z0]],
            [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]],
            [[x0, y0, z1], [x0, y0, z0], [x1, y0, z0], [x1, y0, z1]],
            [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]],
            [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]]
        ];
        for (const [first, second, third, fourth] of faces) {
            this.addTriangle(positions, normals, colors, textureCoordinates, screenVertices, first, second, third, color);
            this.addTriangle(positions, normals, colors, textureCoordinates, screenVertices, first, third, fourth, color);
        }
    }

    addTriangle(positions, normals, colors, textureCoordinates, screenVertices,
                first, second, third, color, textureUV = null) {
        const edgeA = [second[0] - first[0], second[1] - first[1], second[2] - first[2]];
        const edgeB = [third[0] - first[0], third[1] - first[1], third[2] - first[2]];
        const normal = normalize([
            edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
            edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
            edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0]
        ]);
        const vertices = [first, second, third];
        for (let index = 0; index < vertices.length; index++) {
            const vertex = vertices[index];
            positions.push(vertex[0], vertex[1], vertex[2]);
            normals.push(normal[0], normal[1], normal[2]);
            colors.push(color[0], color[1], color[2]);
            textureCoordinates.push(...(textureUV ? textureUV[index] : [0, 0]));
            screenVertices.push(textureUV ? 1 : 0);
        }
    }

    installControls() {
        this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());
        this.canvas.addEventListener("pointerdown", (event) => {
            this.canvas.setPointerCapture(event.pointerId);
            this.drag = {
                x: event.clientX,
                y: event.clientY,
                button: event.button,
                moved: false
            };
            this.lastPointer = [event.clientX, event.clientY];
        });
        this.canvas.addEventListener("pointermove", (event) => {
            if (!this.drag) {
                const hoveredSeat = this.pickSeat(event.clientX, event.clientY);
                this.canvas.style.cursor = hoveredSeat ? "pointer" : "grab";
                this.callbacks.onSeatHover?.(hoveredSeat);
                return;
            }
            const dx = event.clientX - this.lastPointer[0];
            const dy = event.clientY - this.lastPointer[1];
            this.lastPointer = [event.clientX, event.clientY];
            if (Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) > 4) this.drag.moved = true;
            if (this.drag.button === 0) {
                this.camera.yaw -= dx * 0.006;
                this.camera.pitch = clamp(this.camera.pitch + dy * 0.005, 0.12, 1.02);
                this.draw();
            } else if (this.drag.button === 2) {
                this.pan(dx, dy);
                this.draw();
            }
        });
        this.canvas.addEventListener("pointerup", (event) => {
            const drag = this.drag;
            this.drag = null;
            if (drag && !drag.moved && drag.button === 0) {
                const clickedSeat = this.pickSeat(event.clientX, event.clientY);
                if (clickedSeat) this.callbacks.onSeatClick?.(clickedSeat);
            }
        });
        this.canvas.addEventListener("pointercancel", () => { this.drag = null; });
        this.canvas.addEventListener("pointerleave", () => {
            if (!this.drag) this.callbacks.onSeatHover?.(null);
        });
        this.canvas.addEventListener("wheel", (event) => {
            event.preventDefault();
            this.zoom(event.deltaY > 0 ? 2 : -2);
        }, { passive: false });
    }

    pan(dx, dy) {
        const forward = normalize(subtract(this.camera.target, this.eyePosition()));
        const right = normalize(cross(forward, [0, 1, 0]));
        const up = normalize(cross(right, forward));
        const unitsPerPixel = this.camera.distance / Math.max(this.canvas.clientHeight, 1);
        this.camera.target = add(this.camera.target, scale(right, -dx * unitsPerPixel));
        this.camera.target = add(this.camera.target, scale(up, dy * unitsPerPixel));
    }

    zoom(amount) {
        this.camera.distance = clamp(this.camera.distance + amount, 24, 62);
        this.draw();
    }

    resetCamera() {
        this.camera = { yaw: 0.12, pitch: 0.39, distance: 39, target: [0, 1.9, 0] };
        this.draw();
    }

    eyePosition() {
        const { yaw, pitch, distance, target } = this.camera;
        return [
            target[0] + distance * Math.sin(yaw) * Math.cos(pitch),
            target[1] + distance * Math.sin(pitch),
            target[2] + distance * Math.cos(yaw) * Math.cos(pitch)
        ];
    }

    pickSeat(clientX, clientY) {
        const rectangle = this.canvas.getBoundingClientRect();
        if (rectangle.width === 0 || rectangle.height === 0) return null;
        const x = ((clientX - rectangle.left) / rectangle.width) * 2 - 1;
        const y = 1 - ((clientY - rectangle.top) / rectangle.height) * 2;
        const aspect = rectangle.width / rectangle.height;
        const forward = normalize(subtract(this.camera.target, this.eyePosition()));
        const right = normalize(cross(forward, [0, 1, 0]));
        const up = normalize(cross(right, forward));
        const tangent = Math.tan(Math.PI / 8);
        const ray = normalize(add(add(forward, scale(right, x * tangent * aspect)), scale(up, y * tangent)));
        const origin = this.eyePosition();
        let closest = Infinity;
        let result = null;
        for (const seat of this.seats) {
            const hit = hitBox(
                origin,
                ray,
                [seat.x - 0.45, seat.y + 0.12, seat.z - 0.38],
                [seat.x + 0.45, seat.y + 1.22, seat.z + 0.42]
            );
            if (hit !== null && hit < closest) {
                closest = hit;
                result = seat;
            }
        }
        return result;
    }

    draw() {
        const gl = this.gl;
        const rectangle = this.canvas.getBoundingClientRect();
        if (!rectangle.width || !rectangle.height) return;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.round(rectangle.width * pixelRatio);
        const height = Math.round(rectangle.height * pixelRatio);
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        if (width !== this.viewportWidth || height !== this.viewportHeight) {
            this.viewportWidth = width;
            this.viewportHeight = height;
            gl.viewport(0, 0, width, height);
        }

        gl.clearColor(0.055, 0.065, 0.086, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(this.program);

        const eye = this.eyePosition();
        const projection = perspective(Math.PI / 4, width / height, 0.1, 140);
        const view = lookAt(eye, this.camera.target, [0, 1, 0]);
        const viewProjection = multiply(projection, view);
        gl.uniformMatrix4fv(this.matrixLocation, false, viewProjection);

        gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer);
        gl.vertexAttribPointer(this.positionLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.normalBuffer);
        gl.vertexAttribPointer(this.normalLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.colorBuffer);
        gl.vertexAttribPointer(this.colorLocation, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.textureCoordinateBuffer);
        gl.vertexAttribPointer(this.textureCoordinateLocation, 2, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.screenBuffer);
        gl.vertexAttribPointer(this.screenLocation, 1, gl.FLOAT, false, 0, 0);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.movieTexture);
        gl.uniform1i(this.movieTextureLocation, 0);
        gl.drawArrays(gl.TRIANGLES, 0, this.vertexCount);
    }
}

function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
}

function add(first, second) {
    return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

function subtract(first, second) {
    return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

function scale(vector, amount) {
    return [vector[0] * amount, vector[1] * amount, vector[2] * amount];
}

function cross(first, second) {
    return [
        first[1] * second[2] - first[2] * second[1],
        first[2] * second[0] - first[0] * second[2],
        first[0] * second[1] - first[1] * second[0]
    ];
}

function normalize(vector) {
    const length = Math.hypot(vector[0], vector[1], vector[2]) || 1;
    return [vector[0] / length, vector[1] / length, vector[2] / length];
}

function perspective(fieldOfView, aspect, near, far) {
    const focalLength = 1 / Math.tan(fieldOfView / 2);
    const range = 1 / (near - far);
    return new Float32Array([
        focalLength / aspect, 0, 0, 0,
        0, focalLength, 0, 0,
        0, 0, (near + far) * range, -1,
        0, 0, 2 * near * far * range, 0
    ]);
}

function lookAt(eye, target, upDirection) {
    const backward = normalize(subtract(eye, target));
    const right = normalize(cross(upDirection, backward));
    const up = cross(backward, right);
    return new Float32Array([
        right[0], up[0], backward[0], 0,
        right[1], up[1], backward[1], 0,
        right[2], up[2], backward[2], 0,
        -dot(right, eye), -dot(up, eye), -dot(backward, eye), 1
    ]);
}

function dot(first, second) {
    return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

function multiply(first, second) {
    const result = new Float32Array(16);
    for (let column = 0; column < 4; column++) {
        for (let row = 0; row < 4; row++) {
            result[column * 4 + row] =
                first[row] * second[column * 4]
                + first[4 + row] * second[column * 4 + 1]
                + first[8 + row] * second[column * 4 + 2]
                + first[12 + row] * second[column * 4 + 3];
        }
    }
    return result;
}

function hitBox(origin, direction, minimum, maximum) {
    let near = -Infinity;
    let far = Infinity;
    for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(direction[axis]) < 1e-8) {
            if (origin[axis] < minimum[axis] || origin[axis] > maximum[axis]) return null;
            continue;
        }
        let first = (minimum[axis] - origin[axis]) / direction[axis];
        let second = (maximum[axis] - origin[axis]) / direction[axis];
        if (first > second) [first, second] = [second, first];
        near = Math.max(near, first);
        far = Math.min(far, second);
        if (near > far) return null;
    }
    return far < 0 ? null : Math.max(0, near);
}
