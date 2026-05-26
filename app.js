document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('pipelineCanvas');

    if (!canvas) {
        console.error("Canvas element with id 'pipelineCanvas' was not found.");
        return;
    }

    const ctx = canvas.getContext('2d');

    let mouseX = 0;
    let mouseY = 0;

    // APPLICATION STAGE:
    // Handles user input from the mouse, which later affects object rotation speed.
    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();

        mouseX = (e.clientX - rect.left) - (rect.width / 2);
        mouseY = (e.clientY - rect.top) - (rect.height / 2);
    });

    // Two 3D objects are defined using vertices and faces.
    // Each face stores the vertex indices used to draw that polygon.
    const cube = {
        xOffset: -180,
        yOffset: 0,
        zOffset: 0,
        vertices: [
            { x: -60, y: -60, z: -60 }, { x: 60, y: -60, z: -60 },
            { x: 60, y: 60, z: -60 },  { x: -60, y: 60, z: -60 },
            { x: -60, y: -60, z: 60 },  { x: 60, y: -60, z: 60 },
            { x: 60, y: 60, z: 60 },   { x: -60, y: 60, z: 60 }
        ],
        faces: [
            { indices: [0, 1, 2, 3], color: 'rgba(88, 166, 255, 0.45)', stroke: '#58a6ff' },
            { indices: [4, 5, 6, 7], color: 'rgba(56, 139, 253, 0.45)', stroke: '#388bfd' },
            { indices: [0, 4, 7, 3], color: 'rgba(31, 111, 235, 0.45)', stroke: '#1f6feb' },
            { indices: [1, 5, 6, 2], color: 'rgba(110, 118, 129, 0.45)', stroke: '#6e7681' },
            { indices: [0, 1, 5, 4], color: 'rgba(139, 148, 158, 0.45)', stroke: '#8b949e' },
            { indices: [3, 2, 6, 7], color: 'rgba(240, 246, 252, 0.2)', stroke: '#f0f6fc' }
        ]
    };

    const pyramid = {
        xOffset: 180,
        yOffset: 20,
        zOffset: 0,
        vertices: [
            { x: 0, y: -80, z: 0 },
            { x: -70, y: 50, z: -60 },
            { x: 70, y: 50, z: -60 },
            { x: 0, y: 50, z: 70 }
        ],
        faces: [
            { indices: [0, 1, 2], color: 'rgba(247, 129, 102, 0.45)', stroke: '#f78166' },
            { indices: [0, 2, 3], color: 'rgba(255, 166, 0, 0.45)', stroke: '#ffa600' },
            { indices: [0, 3, 1], color: 'rgba(255, 126, 95, 0.45)', stroke: '#ff7e5f' },
            { indices: [1, 2, 3], color: 'rgba(214, 60, 60, 0.45)', stroke: '#d63c3c' }
        ]
    };

    let angleX = 0;
    let angleY = 0;

    function runGraphicsPipeline() {
        // =====================================================
        // STAGE 1: APPLICATION STAGE
        // Updates animation values and applies user interaction.
        // The mouse position controls the rotation speed.
        // =====================================================
        const speedMultiplierX = mouseY * 0.00005;
        const speedMultiplierY = mouseX * 0.00005;

        angleX += 0.01 + speedMultiplierX;
        angleY += 0.01 + speedMultiplierY;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw simple guide lines to show the canvas center.
        ctx.strokeStyle = '#21262d';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(canvas.width / 2, 0);
        ctx.lineTo(canvas.width / 2, canvas.height);
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();

        const masterRenderQueue = [];

        function processObjectGeometry(obj) {
            const projectedVertices = [];
            const cameraDistance = 400;

            // =====================================================
            // STAGE 2: GEOMETRY STAGE
            // Rotates 3D vertices, moves them into world position,
            // and projects them from 3D coordinates to 2D canvas points.
            // =====================================================
            for (let i = 0; i < obj.vertices.length; i++) {
                const vertex = obj.vertices[i];

                // Rotate each vertex around the Y-axis.
                const x1 = vertex.x * Math.cos(angleY) - vertex.z * Math.sin(angleY);
                const z1 = vertex.x * Math.sin(angleY) + vertex.z * Math.cos(angleY);

                // Rotate each vertex around the X-axis.
                const y2 = vertex.y * Math.cos(angleX) - z1 * Math.sin(angleX);
                const z2 = vertex.y * Math.sin(angleX) + z1 * Math.cos(angleX);

                // Move the object to its position in the scene.
                const worldX = x1 + obj.xOffset;
                const worldY = y2 + obj.yOffset;
                const worldZ = z2 + obj.zOffset;

                // Perspective projection: farther points appear smaller.
                const perspectiveScale = cameraDistance / (cameraDistance + worldZ);

                const screenX = (canvas.width / 2) + worldX * perspectiveScale;
                const screenY = (canvas.height / 2) + worldY * perspectiveScale;

                projectedVertices.push({ x: screenX, y: screenY, z: worldZ });
            }

            // Build drawable faces from the projected 2D vertices.
            for (let i = 0; i < obj.faces.length; i++) {
                const face = obj.faces[i];

                let avgZ = 0;
                const facePoints = [];

                for (let j = 0; j < face.indices.length; j++) {
                    const index = face.indices[j];

                    facePoints.push(projectedVertices[index]);
                    avgZ += projectedVertices[index].z;
                }

                avgZ /= face.indices.length;

                masterRenderQueue.push({
                    points: facePoints,
                    color: face.color,
                    stroke: face.stroke,
                    zDepth: avgZ
                });
            }
        }

        processObjectGeometry(cube);
        processObjectGeometry(pyramid);

        // =====================================================
        // STAGE 3: RASTERIZATION STAGE
        // Sorts faces by depth and draws the projected polygons
        // onto the canvas as filled pixels and outlines.
        // =====================================================

        // Painter's algorithm: draw farther faces first.
        masterRenderQueue.sort((faceA, faceB) => faceB.zDepth - faceA.zDepth);

        for (let i = 0; i < masterRenderQueue.length; i++) {
            const face = masterRenderQueue[i];

            ctx.beginPath();

            ctx.moveTo(face.points[0].x, face.points[0].y);

            for (let j = 1; j < face.points.length; j++) {
                ctx.lineTo(face.points[j].x, face.points[j].y);
            }

            ctx.closePath();

            ctx.fillStyle = face.color;
            ctx.fill();

            ctx.strokeStyle = face.stroke;
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        requestAnimationFrame(runGraphicsPipeline);
    }

    requestAnimationFrame(runGraphicsPipeline);
});