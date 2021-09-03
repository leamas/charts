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


    /** Collision data: All intersecting sides. */
    var collisions = [];  // list of [triangleSide, RulerSide].

    /**
     * Aligning data: the two sides closest to a align. If there is one
     * collision, this is the one of the two intersecting sides with the
     * smallest angle.
     * If there is two collisions, this is the side which is not colliding
     * i. e., is contained by the ruler.
     *
     * If no intersection this is either empty or two sides both
     * intersecting the line between the triangle and the ruler center.
     * Aligning refers to side numbers. First ruler side is nw -> ne, the
     * rest counted clockwise. The first triangle side0  is the left -> right,
     * one, next right -> top.
     */
    var align = {rulerSide: null, triangleSide: null, distance: null };

    function isSameSide() {
        return collision[0][0] == collision[1][0]
    }

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


    /**
     * Get point where two lines on form y = ax + c and y = bx + d
     * intersect.
     * @see: https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection
     */
    function getIntersection(a, c, b, d) {
        console.log("getIntersection, a:", a,
                     ", b: ",  b , ", c: ",  c, ", d: ", d)
        if (a == b)
            console.error("Trying to intersect parallel lines");
        return {
            x: (d - c) / (a - b),
            y: (a*d - b*c) / (a - b)
        }
    }


    /**
     * Check if the two lines (p0,p1) and (p2,p3) intersects where each
     * p* item is a point. Returns true if intersect.
     */
    var isIntersecting = (function(){
        // function as singleton so that closure can be used

        // working variable are closed over so they do not need creation
        // each time the function is called. This gives a significant
        // performance boost.
        var v1, v2, v3, cross, u1, u2;
        v1 = {x : null, y : null}; // line p0, p1 as vector
        v2 = {x : null, y : null}; // line p2, p3 as vector
        v3 = {x : null, y : null}; // the line from p0 to p2 as vector

        function isIntersecting(p0, p1, p2, p3) {
            v1.x = p1.x - p0.x;
            v1.y = p1.y - p0.y;
            v2.x = p3.x - p2.x;
            v2.y = p3.y - p2.y;
            cross = v1.x * v2.y - v1.y * v2.x;
            if (cross === 0) {
                return false // cross prod 0 if lines parallel
            }
            v3 = {x : p0.x - p2.x, y : p0.y - p2.y};
            // get unit distance along line p2 p3
            u2 = (v1.x * v3.y - v1.y * v3.x) / cross;
            // is intercept on line p2, p3
            if (u2 >= 0 && u2 <= 1){
                // get unit distance on line p0, p1;
                u1 = (v2.x * v3.y - v2.y * v3.x) / cross;
                // return true if on line else false.
                return (u1 >= 0 && u1 <= 1);
            }
            return false; // no intersect;
        }
        // return function with closure for optimisation.
        return isIntersecting;
    })();

    /** Distance in pixels between p1 and p2. */
    function distance(p1, p2) {
        var deltaX = p1.x - p2.x;
        var deltaY = p1.y - p2.y;
        return Math.sqrt((deltaX * deltaX) + (deltaY * deltaY));
    }

    /** Cross product for two sides, 0 for parallel lines. */
    function crossProduct(side1, side2) {
        const v1 = subPoints(side1.p1, side1.p0);
        const v2 = subPoints(side2.p1, side2.p0);
        return v1.x * v2.y - v1.y * v2.x
    }

    /** Return distance between two given lines. */
    function linesDistance(l1, l2) {
        // lines are y = mx + b1, y = mx + b2
        const m = (l1.p1.y - l1.p0.y) / (l1.p1.x - l1.p0.x);
        const b1 = l1.p1.y - m * l1.p1.x;
        const b2 = l2.p1.y - m * l2.p1.x;
        // https://wikipedia.org/wiki/Distance_between_two_straight_lines
        const distance = Math.abs(b1 - b2) / Math.sqrt(m*m + 1)
        return distance
    }


    /**
     * Return a {centerLine, ruler, triangle} dictionary with the line from
     * triangle to ruler center, the triangle side facing the ruler and the
     * ruler side facing the triangle.
     */
    function getFacingSides() {

        function linesIntersect(l1, l2) {
            return isIntersecting(l1.p0, l1.p1, l2.p0, l2.p1)
        }

        const centerLine = { p0: triangle, p1: ruler }
        var result = { centerLine: centerLine, triangle: null, ruler: null };

        // Find ruler long side intersecting centerLine
        for (var r = 0; r < 3; r += 2) {
            var l = rulerSideByIndex(r);
            if (linesIntersect(centerLine, l)) {
                result.ruler = l;
                break;
            }
        }
        if (result.ruler == null) {
            // No facing long ruler edge.
            console.log("getFacingSides: got no ruler side:")
        }
//        console.log("getFacingSides: got ruler side:", result.ruler)
        // Find the triangle side intersecting centerLine
        for (var t = 0; t < 3; t += 1) {
            var l = triangleSideByIndex(t);
            if (linesIntersect(centerLine, l)) {
                result.triangle = l;
                break;
            }
        }
        if (result.triangle == null)
            console.log("getFacingSides: got no triangle side:")
        return result;
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

    /**
     * Cases:
     *  - Not colliding, no potential align. rulerSide == null,
     *    distance = -2
     *  - Not colliding, potential align (two triangle sides facing a long
     *    ruler side), but not parallel: distance = -1
     *  - Not colliding, parallel sides. rulerSide and triangleSide
     *    defined, distance reflects distance.
     *  - Colliding: collision.isSameSide == false. Two sides defined,
     *    not aligned.
     *  - Colliding: collision.isSameSide == true. collision.notCollided
     *    reflects the triangle side contained by ruler, align possible.
    */
    function checkAlign() {

       // Cross product, 0 for parallel lines.
        function crossProduct(side1, side2) {
            const v1 = subPoints(side1.p1, side1.p0);
            const v2 = subPoints(side2.p1, side2.p0);
            return v1.x * v2.y - v1.y * v2.x
        }

        function linesIntersect(l1, l2) {
            return isIntersecting(l1.p0, l1.p1, l2.p0, l2.p1)
        }

        // Distance between two lines.
        function linesDistance(l1, l2) {
            // lines are y = mx + b1, y = mx + b2
            const m = (l1.p1.y - l1.p0.y) / (l1.p1.x - l1.p0.x);
            const b1 = l1.p1.y - m * l1.p1.x;
            const b2 = l2.p1.y - m * l2.p1.x;
            // https://wikipedia.org/wiki/Distance_between_two_straight_lines
            const distance = Math.abs(b1 - b2) / Math.sqrt(m*m + 1)
            return distance
        }

        if (distance(triangle, ruler) > triangle.height/2 + 100)
            // Too far away to align
            return;
        console.log("Align: close enough")

        // triangle center-> ruler center line
        const centerLine = { p0: triangle, p1: ruler }

        // Find ruler long side intersecting centerLine
        const facingSides = getFacingSides();
        if (facingSides.ruler != null && facingSides.triangle != null ) {
                const cross =
                    crossProduct(facingSides.ruler, facingSides.triangle);
                if (cross < 1) {
                    align.distance =
                        linesDistance(facingSides.ruler, facingSides.triangle);
                    document.getElementById('distance').innerHTML = align.distance; //FIXME
                    console.log("Using parallel triangle side:");
                } else {
                    console.log("Using non-parallel triangle side")
                    align.distance = -1;
                }
        } else {
            console.log("checkAlign: No facing triangle or ruler long side.");
        }
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
/***
        if (collisions-length > 0) {
            document.getElementById('collision').innerHTML = "Yes"; //FIXME
            ruler.x = oldpos.x
            ruler.y = oldpos.y
            getRulerCorners();
        }
        else
            document.getElementById('collision').innerHTML = "no"; //FIXME
**/
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
     * Triangle corner collides in ruler side. Ignore movements straight
     * into ruler. Other movements into ruler rotates the triangle around
     * the colliding corner point to align with the ruler. If the angle
     * difference is "small", triangle aligns with ruler.
     */
    function cornerCollideTriangle(oldpos) {

        /**
         * Compute the smallest possible triangle rotation which aligns
         * one of the triangle sides t1 and t2 with ruler side r1. The
         * result is either a clockwise rotation of t1 or a counter-clockwise
         * (negative) rotation of t2.
         */
        function triangleAlignAngle(t1, t2, r1) {
            var angle1 =
                getRelativeAngle(t1.p0, t1.p1, r1.p0, r1.p1) % Math.PI;
            var angle2 =
                getRelativeAngle(t2.p0, t2.p1, r1.p0, r1.p1) % Math.PI
            if (Math.abs(angle1) > Math.abs(angle2))
                angle1 = Math.PI - angle1
            else
                angle2 = Math.PI - angle2
            return angle1 < angle2 ? angle1 : -angle2
        }

       /**
         * Given two collisions and a drag vector compute
         * whether the triangle should be rotated around the
         * colliding corner or just pulled away from the ruler.
         *
         * Returns:
         *     - 1 for clockwise rotation, aligns s1
         *     - 0 for pull away
         *     - -1 for counter-clockwise rotation, aligns s2
         */
        function compareDrag(s1, s2, dragAngle) {

            /** Given angles min, max and a check if min < a <= max */
            function between(min, a, max) {
                if (min > max) {
                    min = (min + 3 * Math.PI) % (2 * Math.PI) - Math.PI
                    max = (max + 3 * Math.PI) % (2 * Math.PI) - Math.PI
                }
                return min < a && a <= max
            }

            const cwAngle = getAngle(triangle, s1.p0, true);
            const cornerAngle = getAngle(triangle, s1.p1, true);
            const ccwAngle = getAngle(triangle, s2.p1, true);
            //console.log("drag: " + dragAngle/3.14 * 180
            //    +  ", cw: " + cwAngle/3.14 * 180
            //    + ", ccw: " + ccwAngle/3.14 * 180
            //    + ", corner: " + cornerAngle/3.14 *180);

            if (between(cornerAngle, dragAngle, ccwAngle))
                return -1
            if (between(cwAngle, dragAngle, cornerAngle))
                return 1
            return 0;
        }

        /**
         * Rotate triangle around p0 to line (p0, newposition), but
         * not beyond ruler edge defined by maxAngle.
         */
        function rotateCcw(oldpos, p0, maxAngle) {
            const newAngle = getAngle(p0, triangle)
            // Determine magnitude and angle for old
            // and new center relative p0
            const oldAngle = getAngle(p0, oldpos);
            var rotAngle = newAngle - oldAngle;
            rotAngle = Math.abs(rotAngle) > Math.abs(maxAngle) ?
                maxAngle : rotAngle;

            const center = subPoints(triangle, p0)
            const length = Math.sqrt(center.x * center.x
                                     + center.y * center.y)
            // Compute x,y center displacement when rotating around p0
            const diff = {
                x: length * Math.cos(rotAngle),
                y: -length * Math.sin(rotAngle)
            };
            //console.log("p0: ", p0)
            //console.log("diff: ", diff);
            //console.log("Old center, x: " + triangle.x + ", y: " + triangle.y);
            //console.log("length: " + length);
            triangle.x = p0.x + diff.x
            triangle.y = p0.y + diff.y
            //console.log( "New center, x: " + triangle.x + ", y: " + triangle.y);
            triangle.angle  += rotAngle;
        }

        if (collisions.length < 2)
            return;
        const side1 = triangleSideByIndex(collisions[0][0]);
        const side2 = triangleSideByIndex(collisions[1][0]);
        const side3 = rulerSideByIndex(collisions[0][1]);
        const alignAngle = triangleAlignAngle(side1, side2, side3);
        console.log("Align angle: " + alignAngle / 3.14 * 180);
        const dragAngle = getAngle(oldpos, triangle, true)
        const action =
            compareDrag(side1, side2, dragAngle);
        if (action == -1) {
            var a = getAngle(side1.p1, oldpos)
            var b = getAngle(side1.p1, triangle)
            var c = b - a;
            var newAngle = Math.abs(c) > alignAngle ? alignAngle : c;
            rotateCcw(oldpos, side1.p1, newAngle)
        }
        else if (action == 1)
            console.log("rotate cw")
        else
            console.log("drag back, distance: " + align.distance);

        // For now: block movements:
        triangle.x = oldpos.x
        triangle.y = oldpos.y
        collisions = [];
        // console.log("Corner collide, angle: " + angle/3.14 * 180);
    }

    /** Align triangle to collided ruler edge. */
    function alignTriangle() {

        if (align.distance == -2)
            // We cannot align (no potential sides).
            return;
        const facingSides = getFacingSides();
        if (facingSides.ruler == null || facingSides.triangle == null)
            // No facing long side, i. e. a short one:
            return;
        if (align.distance < 0) {
            // Get diff between ruler and triangle angle and adjust.
            const side1 = facingSides.ruler
            const side2 = facingSides.triangle
            // const side1 = triangleSideByIndex(collisions[0][0]);
            // const side2 = triangleSideByIndex(collisions[1][0]);
            // const rulerSide = rulerSideByIndex(collisions[0][1]);
            const triangleAngle = getAngle(side1.p0, side1.p1);
            console.log("Aligning, old angle: " + triangleAngle/3.14 * 180);
            const rulerAngle = getAngle(side2.p0, side2.p1);
            const diff =
                getRelativeAngle(side1.p0, side1.p1,
                                 side2.p0, side2.p1, true) % Math.PI;
            triangle.angle += rulerAngle > triangleAngle ? diff : -diff;
            console.log("Aligning, new angle: " + triangle.angle/3.14 * 180);
            getTriangleCorners();
        }
        const l1 = facingSides.ruler;
        const l2 = facingSides.triangle;
        const cp = crossProduct(l1, l2);
        const distance = linesDistance(l1, l2);

        if (Math.abs(distance) <= 2)
            // we are aligned!
            return;

        if (Math.abs(distance) <= 5 ) {
            console.info("Attaching triangle")
            const oldPos = {x: triangle.x, y:triangle.y}
            // Get line perpendicular to ruler and move triangle along it.
            var toRuler = ruler.angle - Math.PI / 2;
            if (toRuler < 0)
                toRuler += Math.PI * 2;
            if (toRuler > Math.PI * 2)
                toRuler -= Math.PI * 2;
            triangle.x += Math.cos(toRuler) * (distance - 1);
            triangle.y += Math.sin(toRuler) * (distance - 1);
            // Move back if new triangle pos overlaps ruler.
            getTriangleCorners();
            const c1 =
                isIntersecting(triangle.left, triangle.top, l1.p0, l1.p1);
            const c2 =
                isIntersecting(triangle.right, triangle.top, l1.p0, l1.p1);
            if (c1 || c2) {
                triangle.x = oldPos.x
                triangle.y = oldPos.y
            }
        }
    }

    /** Slide triangle along ruler. */
    function slideTriangle(p) {
        console.log("Sliding triangle, from %d, %d", triangle.x, triangle.y);
        console.log("Sliding triangle, drag to : %o", p);
        const dragAngle =
            getRelativeAngle(triangle, p, triangle.left, triangle.right);
        const facingSides = getFacingSides();
        if (facingSides.triangle == null) {
            console.log("slideTriangle: No triangle side, giving up.");
            return;
        }
        const side = facingSides.triangle;
        const slideLeft = getAngle(side.p0, side.p1, true);
        const slideRight = slideLeft > Math.PI ?
            slideLeft - Math.PI : slideLeft + Math.PI;
        const pullBack = slideRight + Math.PI/2;
        const dist = distance(triangle, p);
        document.getElementById('distance').innerHTML = dist; //FIXME
        console.log("dragAngle: " + dragAngle / Math.PI * 180);
        const absAngle = Math.abs(dragAngle);
        if (absAngle < Math.PI/4) {
            triangle.x += dist * Math.sin(slideRight);
            triangle.y += dist * Math.cos(slideRight);
            console.log("Sliding right");
        } else if (absAngle <= Math.PI && absAngle > 3*Math.PI / 4) {
            triangle.x += dist * Math.sin(slideLeft);
            triangle.y += dist * Math.cos(slideLeft);
            console.log("Sliding left");
        } else if (absAngle < Math.PI) {
            //triangle.x = p.x;
            //triangle.y = p.y;
            console.log("No slide, pulling back");
        } else
            console.log("No slide at all.");
    }

    /**
     * Move triangle to new position p.  Pitfalls:
     *   - One corner collides with ruler. Handle by rotating
     *     around colliding corner
     *   - Two corners collides. Handle by aligning to ruler.
     */
    function moveTriangle(ctx, p) {
        var oldpos = { x: triangle.x, y: triangle.y };
        clear(ctx, triangle);
        checkAlign();
        if (align.distance != null && align.distance < 6) {
                //slideTriangle(p)
                alignTriangle();
        } else {
            triangle.x = p.x;
            triangle.y = p.y;
            getTriangleCorners()
            if (collisions.length == 2)
                cornerCollideTriangle(oldpos);
            if (collisions.length > 0) {
                document.getElementById('collision').innerHTML = "Yes"; //FIXME
                triangle.x = oldpos.x;
                triangle.y = oldpos.y;
                collisions = [];
            } else {
                document.getElementById('collision').innerHTML = "No"; //FIXME
                checkAlign();
                //if (align.distance >= 0 && align.distance < 12)
                //    alignTriangle();
            }
        }
        draw(triangle, triangleCanvas);
        // clear() clears the bounding rect which might damage the ruler, so:
        draw(ruler, rulerCanvas);
    }

    /** Rotate triangle according to new handle position. */
    function rotateTriangle(ctx, p, rightHandle = true) {
        const oldpos = { x: triangle.x, y: triangle.y };
        const oldAngle = triangle.angle;
        const facingSides = getFacingSides();
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
