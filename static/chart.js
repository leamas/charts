function on_keypress(event) {
    alert("keypress");
}

function onBodyLoad() {
    const TRIANGLE_SRC = "../images/triangle.png";
    const RULER_SRC = "../images/ruler.png";

    const TRIANGLE_WIDTH = 807;
    const TRIANGLE_HEIGHT = 407;
    const RULER_WIDTH = 1160;
    const RULER_HEIGHT = 69;

    const HANDLE_WIDTH = 50;

    var triangle = {
        x: 800,                  /** Center x coordinate. */  // FIXME
        y: 500,                  /** Center y coordinate. */  // FIXME
//        x: 1600,                  /** Center x coordinate. */
//        y: 1000,                  /** Center y coordinate. */
        width: TRIANGLE_WIDTH,
        height: TRIANGLE_HEIGHT,
        angle: 0,
        left: null,               /** Left rotate handle x, y */
        right: null,              /** Right rotate handle x, y */
        middle: null,             /** Center point on longest side. */
        top: null                 /** Top 90 degrees corner. */
    };

    var ruler = {
        'x': 800,
        'y': 200,
//        'x': 1600,
//        'y': 400,
        width: RULER_WIDTH,
        height: RULER_HEIGHT,
        angle: 0,
        left: null,
        right: null,
        ne: null,
        se: null,
        sw: null,
        nw: null
    };


    /** Active tool: reflects a currently dragged handle. */
    var currentTool = null;

    var triangleCanvas;
    var rulerCanvas;


    // Ruler four sides, first one is the topmost nw -> ne.
    function rulerSideByIndex(ix) {
        switch (ix) {
            case 0: return {p0: ruler.nw, p1: ruler.ne};
            case 1: return {p0: ruler.ne, p1: ruler.se};
            case 2: return {p0: ruler.se, p1: ruler.sw};
            case 3: return {p0: ruler.sw, p1: ruler.nw};
            default:
                    console.error("Illegal ruler side: " +ix );
                    return null;
                    break;
        }
    }

    // Triangle three sides, first is the long one.
    function triangleSideByIndex(ix) {
        switch (ix) {
            case 0 : return {p0: triangle.left, p1: triangle.right};
            case 1 : return {p0: triangle.right, p1: triangle.top};
            case 2 : return {p0: triangle.top, p1: triangle.left};
            default:
                    console.error("Illegal triangle side: " +ix );
                    return null;
                    break;
        }
    }


    /** Distance in pixels between p1 and p2. */
    function distance(p1, p2) {
        var deltaX = p1.x - p2.x;
        var deltaY = p1.y - p2.y;
        return Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
    }

    /** Angle in radians  between line from p1 to p2 and y == 0 line, ccw. */
    function getAngle(p1, p2, noNegatives) {
        var dy = p1.y - p2.y;
        var dx = p1.x - p2.x;
        var a =  Math.atan2(dy, dx);
        if (noNegatives && a < 0)
            a = Math.PI * 2 + a;
        return a;
    }

    /** Angle (positive radians) p0 -> p1 measured from line/angle p2 -> p3 */
    function getRelativeAngle(p0, p1, p2, p3) {
        var a0 = getAngle(p0, p1, true)
        var a1 = getAngle(p2, p3, true);
        return Math.abs(a0 - a1);
    }

    /** Vector addition of two points. */
    function addPoints(p1, p2) {
        return { x: p1.x + p2.x, y: p1.y + p2.y }
    }

    /** Vector subtract p2 from p1 */
    function subPoints(p1, p2 ) {
        return { x: p1.x - p2.x, y: p1.y - p2.y }
    }

    /** Vector multiply points  p1 and p2 */
    function multPoints(p1, p2 ) {
        return { x: p1.x * p2.x, y: p1.y * p2.y }
    }

    /** Position relative canvas of mouse click event e.*/
    function getMousePos(e, canvas) {
        var rect = canvas.getBoundingClientRect();
        return {
            x: Math.floor(
                (e.clientX - rect.left) / (rect.right - rect.left)
                * canvas.width),
            y: Math.floor
                ((e.clientY - rect.top) / (rect.bottom - rect.top)
                    * canvas.height)
        };
    }

   /*** Draw a circle (debug) */
    function drawCircle(ctx, p) {
        const radius = 30;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = 'green';
        ctx.fill();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#003300';
        ctx.stroke();
    }

    /** Draw object (ruler or triangle) on canvas. */
    function draw(obj, canvas) {
        var ctx = document.getElementById('mapCanvas').getContext('2d');
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.angle);
        ctx.translate(-obj.x, -obj.y);
        ctx.drawImage(canvas, obj.x - obj.width/2, obj.y - obj.height/2);
        ctx.restore();
    }

    /** Clear object (ruler or triangle) on canvas. */
    function clear(ctx, obj) {
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.angle);
        ctx.translate(-obj.x, -obj.y);
        // Add one pixel frame around for rounding errors.
        ctx.clearRect(obj.x - obj.width/2 - 1,
                      obj.y - obj.height/2 - 1,
                      obj.width + 1,
                      obj.height + 1);
        ctx.restore();
    }

    /** Setup the ruler object. */
    function initRuler() {
        getRulerCorners();
        rulerCanvas = document.createElement('canvas');
        rulerCanvas.width = ruler.width;
        rulerCanvas.height = ruler.width;
        var image = new Image();
        image.onload = function () {
            var ctx = rulerCanvas.getContext('2d');
            ctx.drawImage(image, 0, 0)
            draw(ruler, rulerCanvas);
        }
        image.src = RULER_SRC;
    }

    /** Update ruler's corner and handle coordinates. */
    function getRulerCorners() {
        const sin = Math.sin(ruler.angle);
        const cos = Math.cos(ruler.angle);
        const height = { x: sin * ruler.height/2, y: cos * ruler.height/2 };
        const heightUp = addPoints(ruler, multPoints({x: 1, y :-1}, height));
        const heightDown = addPoints(ruler, multPoints({x: -1, y: 1}, height));
        const width = { x: cos * ruler.width/2, y: sin * ruler.width/2 };
        ruler.left = subPoints(ruler, width);
        ruler.right = addPoints(ruler, width);
        ruler.nw = subPoints(heightUp, width);
        ruler.ne = addPoints(heightUp, width );
        ruler.sw = subPoints(heightDown, width);
        ruler.se = addPoints(heightDown, width);
    }

    /** Move ruler to new position p.*/
    function moveRuler(ctx, p) {
        const oldpos = {x: ruler.x, y: ruler.y};
        clear(ctx, ruler);
        ruler.x = p.x;
        ruler.y = p.y;
        getRulerCorners();
        draw(ruler, rulerCanvas);
    }

    /** Rotate ruler according to new handle position. */
    function rotateRuler(ctx, p, leftHandle = true) {
        const oldpos = { x: triangle.x, y: triangle.y };
        const oldAngle = ruler.angle;
        clear(ctx, ruler);

        // Compute rotation center p0 and baseline angle diff.
        const p0 = leftHandle ? ruler.ne : ruler.nw;
        const baseAngle = getAngle(p0, leftHandle ? ruler.nw : ruler.ne);
        const deltaAngle = getAngle(p0, p) - baseAngle;

        // Compute coordinates relative p0 + sine/cosine.
        const cos = Math.cos(deltaAngle)
        const sin = Math.sin(deltaAngle)
        var relCenter = subPoints(ruler, p0);

        const angle =
            leftHandle ? getAngle(ruler.ne, p) : getAngle(p, ruler.nw);

        ruler.x = p0.x + cos*relCenter.x - sin*relCenter.y
        ruler.y = p0.y + cos*relCenter.y + sin*relCenter.x
        ruler.angle = angle;
        getRulerCorners();
        draw(ruler, rulerCanvas);
    }

    /** Setup the triangle and it's canvas. */
    function initTriangle() {
        getTriangleCorners();
        triangleCanvas = document.createElement('canvas');
        triangleCanvas.width = triangle.width;
        triangleCanvas.height = triangle.width;
        var image = new Image();
        image.onload = function () {
            var ctx = triangleCanvas.getContext('2d');
            ctx.drawImage(image, 0, 0)
            draw(triangle, triangleCanvas);
        }
        image.src = TRIANGLE_SRC;
    }

    /**
     * Move triangle to new position p.  
     */
    function moveTriangle(ctx, p) {
        var oldpos = { x: triangle.x, y: triangle.y };
        clear(ctx, triangle);
        triangle.x = p.x;
        triangle.y = p.y;
        getTriangleCorners()
        draw(triangle, triangleCanvas);
        // clear() clears the bounding rect which might damage the ruler, so:
        draw(ruler, rulerCanvas);
    }

    /** Rotate triangle according to new handle position. */
    function rotateTriangle(ctx, p, rightHandle = true) {
        const oldpos = { x: triangle.x, y: triangle.y };
        const oldAngle = triangle.angle;
        clear(ctx, triangle);

        // Compute rotation center p0 and baseline angle diff.
        const p0 = rightHandle ? triangle.right : triangle.left;
        const p1 = rightHandle ? triangle.left : triangle.right;
        const baseAngle = getAngle(p0, p1);
        const deltaAngle = getAngle(p0, p) - baseAngle;

        // Compute coordinates relative p0 + sine/cosine.
        const cos = Math.cos(deltaAngle)
        const sin = Math.sin(deltaAngle)
        const relCenter = subPoints(triangle, p0);
        const relTop = subPoints(triangle.top, p0);

        // Rotate the relative coordinates and update triangle center/angle
        triangle.top.x = p0.x + cos*relTop.x - sin*relTop.y
        triangle.top.y = p0.y + cos*relTop.y + sin*relTop.x
        triangle.x = p0.x + cos*relCenter.x - sin*relCenter.y
        triangle.y = p0.y + cos*relCenter.y + sin*relCenter.x
        triangle.angle = getAngle(triangle.top, triangle) - Math.PI/2;
        getTriangleCorners();

        draw(triangle, triangleCanvas);
        draw(ruler, rulerCanvas);
    }

    /** Update triangle's corner coordinates based on center and angle. */
    function getTriangleCorners () {
        const width = triangle.width/2;
        const height = triangle.height/2;
        const cos = Math.cos(triangle.angle);
        const sin = Math.sin(triangle.angle);
        const rotatedWidth = {x: cos *  width, y: sin * width};
        const rotatedHeight = {x: -sin * height, y: cos * height};

        triangle.middle =
            addPoints(triangle, {x: sin * height, y: -cos * height} )
        triangle.left = subPoints(triangle.middle, rotatedWidth);
        triangle.right = addPoints(triangle.middle, rotatedWidth);
        triangle.top = addPoints(triangle, rotatedHeight);
    }

    /** Return reflecting possible handle "near" to p, or null. */
    function findNearbyTool(p, canvas) {
        if (distance(p, ruler) < HANDLE_WIDTH)
            return 'moveRuler';
        if (distance(p, ruler.left) < HANDLE_WIDTH)
            return 'rotateRulerLeft';
        if (distance(p, ruler.right) < HANDLE_WIDTH)
            return 'rotateRulerRight';
        if (distance(p, triangle) < HANDLE_WIDTH)
            return 'moveTriangle';
        if (distance(p, triangle.left) < HANDLE_WIDTH)
            return 'rotateTriangleLeft';
        if (distance(p, triangle.right) < HANDLE_WIDTH)
            return 'rotateTriangleRight';
        return null;
    }

    /** Set the hand cursor on/off- */
    function setMoveCursor(active = true) {
        document.getElementById('mapCanvas').style.cursor =
            active ? 'move' : 'default';
    }

    /** DOM mousedown event: possibly initiate drag- */
    function onMousedown(e) {
        if (e.buttons != 1)
            return;
        var canvas = document.getElementById('mapCanvas');
        var p = getMousePos(e, canvas);
        currentTool = findNearbyTool(p, canvas);
        if (currentTool != null)
            setMoveCursor();
    }

    /** DOM mouseup event:  stop drag-*/
    function onMouseup(e) {
        setMoveCursor(false);
        currentTool = null;
    }

    /** DOM mousemove event: possibly drag current tool. */
    var onMousemove = (function() {
        const handlerByTool = {
            'moveRuler': moveRuler,
            'moveTriangle': moveTriangle,
            'rotateRulerLeft': rotateRuler,
            'rotateRulerRight':
                function(c, p) { rotateRuler(c, p, false); },
            'rotateTriangleLeft': rotateTriangle,
            'rotateTriangleRight':
                function(c, p) { rotateTriangle(c, p, false); }
        }
        var canvas = document.getElementById('mapCanvas');
        var ctx = canvas.getContext('2d');

        function onMousemove(e) {
            const p = getMousePos(e, canvas);
            document.getElementById('x').innerHTML = p.x ;//FIXME
            document.getElementById('y').innerHTML = p.y ;//FIXME

            if (findNearbyTool(p, canvas) != null)
                setMoveCursor()
            else if (currentTool == null)
                setMoveCursor(false)
            if (e.buttons != 1 || currentTool == null)
                return;
            handlerByTool[currentTool](ctx, p);
        };

        return onMousemove;
    })();

    function on_keypress(event) {
        //alert("keypress: "  + event.key); // FIXME
    }

    document.getElementById('dbgText').innerHTML = "something"; //FIXME
    document.getElementById('collision').innerHTML = "inited"; //FIXME
    window.addEventListener('mousedown', onMousedown);
    window.addEventListener('mouseup', onMouseup);
    window.addEventListener('mousemove', onMousemove);
    var body = document.getElementsByTagName('body')[0];
    body.onkeypress = on_keypress;

    initTriangle();
    initRuler();

}
