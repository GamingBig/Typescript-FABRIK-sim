/*
    Auteur: Joery Münninghoff
    Aanmaakdatum: 18/05/2022 11:10

    Omschrijving: FABRIK sim
*/

var mouseX = 0;
var mouseY = 0;

interface Point {
	posX: number;
	posY: number;
	prevX: number;
	prevY: number;
	inertiaX: number;
	inertiaY: number;
	siblings: Point[];

	radius?: number;
	selected?: boolean;
	hover?: boolean;
	locked: boolean;
	index?: number;

	mag?: () => number;
	normalize?: () => number;
}

const points: Point[] = [];
var temp: any[][] = [];

//? Settings
const maxIterations = 10;
var numPoints = 100;
var distanceBtwnPoints = 100;

const canvas: HTMLCanvasElement = document.querySelector("#render");
const ctx = canvas.getContext("2d");
var pointSlider: any = document.querySelector("#numPoints");

var frameTime = Date.now();
var baseFPS = 60;
var frameList: number[] = [];
var prevFPS = "60";

init();

function init() {
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;
	ctx.imageSmoothingEnabled = true;

	var loop = 10;
	var curX = 0;
	var reverse = false;

	for (let i = 0; i < numPoints; i++) {
		for (let j = 0; j < numPoints; j++) {
			if (curX / 100 == loop) {
				reverse = true;
			} else if (curX == 0) {
				reverse = false;
			}
			if (reverse) {
				curX--;
			} else {
				curX++;
			}
		}
		console.log(curX / 100, reverse);

		const curPoint: Point = {
			posX: curX + 100 + (canvas.width / 2 - loop * 65),
			posY: Math.sinh(i / 100) * 100 - 100 * i,
			radius: 20,
			prevX: 0,
			prevY: 0,
			inertiaX: 0,
			inertiaY: 0,
			locked: false,
			index: i,
			siblings: [],
		};
		points.push(curPoint);
	}

	points.forEach((point, i) => {
		var prevPoint = points[i - 1] ?? undefined;
		var nextPoint = points[i + 1] ?? undefined;

		if (prevPoint) {
			point.siblings.push(prevPoint);
		}
		if (nextPoint) {
			point.siblings.push(nextPoint);
		}
	});

	render();
}

var size: number;

function pointSliderUpdates() {
	numPoints = pointSlider.value;

	AddPoints();
}

function render() {
	canvas.width = document.body.clientWidth;
	canvas.height = document.body.clientHeight;

	var sizeSlider: any = document.querySelector("#size");
	var distanceSlider: any = document.querySelector("#distance");

	size = sizeSlider.value / 20;
	distanceBtwnPoints = distanceSlider.value;
	pointSlider.value = numPoints;

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	drawFPS(ctx);

	solvePoints();

	drawPoints(points, ctx, canvas);

	requestAnimationFrame(render);
}

var deltaTime: number;

function drawFPS(ctx: CanvasRenderingContext2D) {
	var height = window.innerHeight / 50;
	ctx.font = height + "px Arial";
	ctx.fillStyle = "white";
	ctx.lineWidth = height / 10;
	ctx.strokeText(prevFPS, 0, height);
	ctx.fillText(prevFPS, 0, height);

	deltaTime = (Date.now() - frameTime) / (1000 / baseFPS);
	frameTime = Date.now();
	frameList.push(baseFPS / deltaTime);
	if (frameList.length >= 100) {
		var sum = frameList.reduce((a, b) => a + b, 0);
		sum /= frameList.length;
		frameList = [];
		prevFPS = Math.round(sum).toString();
	}
}

function drawPoints(points: Point[], ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	drawLines(points, ctx, canvas);

	//? Update randomly
	var jLeft = [];
	for (let j = 0; j < points.length; j++) {
		jLeft.push(j);
	}
	for (let j = 0; j < points.length; j++) {
		var curJindex = Math.floor(Math.random() * jLeft.length);
		var curJ = jLeft[curJindex];
		const point = points[j];
		jLeft.splice(j, 1);

		point.radius = 20 * size;

		if (point.posX == NaN) {
			points.splice(point.index, 1);
		}

		ctx.beginPath();
		ctx.arc(point.posX, point.posY, point.radius, 0, 2 * Math.PI);
		var color = "#21252b";
		if (point.locked) {
			color = "#ff0000";
			if (point.hover) {
				color = "#ffa0a0";
			}
		} else if (point.selected) {
			color = "#cccccc";
		} else if (point.hover) {
			color = "#b2b2b2";
		}
		ctx.fillStyle = color;
		ctx.fill();

		if (!point.locked) {
			updatePoint(point);
		}
	}
	temp.forEach((coord) => {
		ctx.beginPath();
		ctx.arc(coord[0], coord[1], 10, 0, 2 * Math.PI);
		ctx.fillStyle = "#ff0000";
		ctx.fill();
		ctx.closePath();
		temp.shift();
	});
}
function drawLines(points: Point[], ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
	var drawnIndexes = [];
	points.forEach((point, i) => {
		point.siblings.forEach((sibling) => {
			drawnIndexes.push(sibling.index);
			ctx.beginPath();
			ctx.moveTo(point.posX, point.posY);
			ctx.strokeStyle = "#919191";
			ctx.lineWidth = 10 * size;
			ctx.lineTo(sibling.posX, sibling.posY);
			ctx.stroke();
			ctx.strokeStyle = "#000";
		});
	});
}

var connectIndex: number;
var createIndex: number;

canvas.onmousedown = (ev) => {
	var curX = ev.clientX;
	var curY = ev.clientY;
	if (ev.buttons == 1 && !ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
		var closestPoint: Point;
		var closestDist = Infinity;
		points.forEach((point) => {
			var dist = dstToCoord(point.posX, point.posY, curX, curY);
			if (dist < closestDist && dist < point.radius) {
				closestDist = dist;
				closestPoint = point;
			}
			point.selected = false;
		});
		if (closestPoint) {
			closestPoint.selected = true;
		}
	}

	// Connect points
	if (ev.buttons == 1 && ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
		var closestPoint: Point;
		var closestDist = Infinity;
		points.forEach((point) => {
			var dist = dstToCoord(point.posX, point.posY, curX, curY);
			if (dist < closestDist && dist < point.radius) {
				closestDist = dist;
				closestPoint = point;
			}
		});
		if (!closestPoint) {
			return;
		}
		if (!connectIndex) {
			connectIndex = closestPoint.index;
		} else {
			var pointToConnect = points.find((tempPoint) => {
				return tempPoint.index == connectIndex;
			});

			if (
				closestPoint.siblings.find((sibling) => {
					return sibling.index == connectIndex;
				}) ||
				connectIndex == closestPoint.index
			) {
				connectIndex = undefined;
				return;
			}

			closestPoint.siblings.push(pointToConnect);
			pointToConnect.siblings.push(closestPoint);
			connectIndex = undefined;
		}
	}

	//? Create point
	if (ev.buttons == 1 && !ev.shiftKey && ev.ctrlKey && !ev.altKey) {
		var closestPoint: Point;
		var closestDist = Infinity;
		points.forEach((point) => {
			var dist = dstToCoord(point.posX, point.posY, curX, curY);
			if (dist < closestDist && dist < point.radius) {
				closestDist = dist;
				closestPoint = point;
			}
		});
		if (!closestPoint && !createIndex) {
			return;
		}
		if (!createIndex) {
			createIndex = closestPoint.index;
		} else {
			var selectedPoint = points.find((point) => point.index == createIndex);

			var newPoint: Point = {
				posX: mouseX,
				posY: mouseY,
				radius: 20,
				prevX: 0,
				prevY: 0,
				inertiaX: 0,
				inertiaY: 0,
				locked: false,
				index: points.length + 1,
				siblings: [selectedPoint],
			};

			points.push(newPoint);

			selectedPoint.siblings.push(newPoint);
			newPoint.siblings.push(selectedPoint);

			numPoints++;

			updatePoint(newPoint, curX, curY);

			newPoint.locked = true;

			createIndex = undefined;
			// debugger
		}
	}

	//? Delete point
	if (ev.buttons == 1 && !ev.shiftKey && !ev.ctrlKey && ev.altKey) {
		var closestPoint: Point;
		var closestDist = Infinity;
		points.forEach((point) => {
			var dist = dstToCoord(point.posX, point.posY, curX, curY);
			if (dist < closestDist && dist < point.radius) {
				closestDist = dist;
				closestPoint = point;
			}
		});
		if (!closestPoint) {
			return;
		}

		var sibling1 = closestPoint.siblings[0];
		sibling1.siblings.splice(
			sibling1.siblings.findIndex((point) => point.index == closestPoint.index),
			1
		);

		for (let i = 1; i < closestPoint.siblings.length; i++) {
			const sibling = closestPoint.siblings[i];
			sibling.siblings.splice(
				sibling.siblings.findIndex((point) => point.index == closestPoint.index),
				1
			);
			sibling.siblings.push(sibling1);
			sibling1.siblings.push(sibling);
		}

		numPoints -= 1;

		points.splice(closestPoint.index, 1);

		points.forEach((point, i) => {
			point.index = i;
		});
	}
};
canvas.onmousemove = (ev) => {
	ev.preventDefault();
	var curX = ev.clientX;
	var curY = ev.clientY;
	mouseX = curX;
	mouseY = curY;
	if (ev.buttons == 1 && !ev.shiftKey && !ev.ctrlKey) {
		points.forEach((point) => {
			if (point.selected && !point.locked) {
				updatePoint(point, curX, curY);
			}
			if (point.locked && point.selected) {
				point.prevX = point.posX;
				point.prevY = point.posY;
				point.posX = curX;
				point.posY = curY;
			}
		});
	}
	var closestPoint: Point;
	var closestDist = Infinity;
	points.forEach((point) => {
		var dist = dstToCoord(point.posX, point.posY, curX, curY);
		if (dist < closestDist && dist < point.radius) {
			closestDist = dist;
			closestPoint = point;
		} else {
			point.hover = false;
		}
	});
	if (closestPoint) {
		closestPoint.hover = true;
	}
};
canvas.onmouseup = (ev) => {
	if (ev.button == 0) {
		points.forEach((point) => {
			point.selected = false;
		});
	}
};

canvas.oncontextmenu = (ev) => {
	ev.preventDefault();
	var curX = ev.clientX;
	var curY = ev.clientY;
	var closestPoint: Point;
	var closestDist = Infinity;

	points.forEach((point) => {
		if (point.selected) {
			closestPoint = point;
			return;
		}
		var dist = dstToCoord(point.posX, point.posY, curX, curY);
		if (dist < closestDist && dist < point.radius) {
			closestDist = dist;
			closestPoint = point;
		}
	});
	if (closestPoint) {
		closestPoint.locked = !closestPoint.locked;
		closestPoint.selected = false;
	}
};

function updatePoint(point: Point, curX?: number, curY?: number) {
	if (!point.selected) {
		if (curX) {
			point.posX = curX;
			point.posY = curY;
		}
		point.posX += point.inertiaX;
		point.posY += point.inertiaY;
		if (point.inertiaY < 0) {
			point.inertiaY -= Math.expm1(point.inertiaY);
		} else if (!point.selected) {
			point.inertiaY = Math.min(point.inertiaY + 0.1, 10);
		}
		clampToSides(point, false, true);

		if (point.posY == canvas.height - point.radius) {
			point.inertiaY = 0;
			point.inertiaX *= 0.9;
		}
	} else {
		point.inertiaY = (point.posY - point.prevY) * 0.5;
		point.inertiaX = (point.posX - point.prevX) * 0.5;
	}

	// Slow the speed down
	if (point.inertiaX !== 0) {
		if (point.inertiaX < 0) {
			point.inertiaX += Math.min(-Math.expm1(Math.abs(point.inertiaX) / 5000), 10);
		} else {
			point.inertiaX -= Math.max(Math.expm1(Math.abs(point.inertiaX) / 5000), -10);
		}
	}

	// Walls
	if (point.posX < point.radius || point.posX > canvas.width - point.radius) {
		point.inertiaX *= -0.5;
		clampToSides(point, true);
	}

	point.prevX = point.posX;
	point.prevY = point.posY;
}

function dstToCoord(x1: number, y1: number, x2: number, y2: number): number {
	// Thanks Pythagoras
	var a = x1 - x2;
	var b = y1 - y2;

	var dist = Math.sqrt(a * a + b * b);
	return dist;
}

//? https://stackoverflow.com/questions/17190981/how-can-i-interpolate-between-2-points-when-drawing-with-canvas
//? modified
function interpolate(x1: number, y1: number, x2: number, y2: number, frac: number): number[] {
	// points A and B, frac between 0 and 1
	var nx = x1 + (x2 - x1) * frac;
	var ny = y1 + (y2 - y1) * frac;
	return [nx, ny];
}

function solvePoints() {
	for (let i = 0; i < 10; i++) {
		for (let i = 0; i < points.length - 1; i++) {
			const point = points[i];
			point.siblings.forEach((sibling) => {
				if (sibling.posX == NaN) {
					console.log(sibling);
					return;
				}

				var dx = point.posX - sibling.posX;
				var dy = point.posY - sibling.posY;
				var distance = Math.sqrt(dx ** 2 + dy ** 2);

				var difference = distanceBtwnPoints * size - distance;

				var percent = difference / distance / 2;
				var offsetX = !point.locked ? dx * percent : 0;
				var offsetY = !point.locked ? dy * percent : 0;

				var origX = point.prevX;
				var origY = point.prevY;
				if (!sibling.locked) {
					sibling.posX -= offsetX;
					sibling.posY -= offsetY;
				}
				if (!point.locked) {
					point.posX += offsetX;
					point.posY += offsetY;
				}

				if (point.selected) {
					point.posX = mouseX;
					point.posY = mouseY;
				}
				if (point.locked && !point.selected) {
					point.posX = origX;
					point.posY = origY;
				}

				clampToSides(point, true, true);
				point.prevY = point.posY;
				point.prevX = point.posX;
				sibling.posY = Math.max(sibling.posY, point.posY - distanceBtwnPoints);
			});
		}
		points.reverse();
	}
	points.sort((a, b) => a.index - b.index);
}

function debug(message: string) {
	var measurements = ctx.measureText(message);
	var prevStyle = ctx.fillStyle;
	ctx.fillStyle = "#ffffffff";
	ctx.fillRect(canvas.width - 400, 0, 400, 40);
	ctx.fillRect(canvas.width - 400, 0, 400, 40);
	ctx.strokeText(message, canvas.width - measurements.width, 30);
	ctx.fillText(message, canvas.width - measurements.width, 30);
	ctx.fillStyle = prevStyle;
}

function clampToSides(point: Point, x?: boolean, y?: boolean) {
	if (x) {
		point.posX = Math.max(Math.min(canvas.width - point.radius, point.posX), point.radius);
	}
	if (y) {
		point.posY = Math.min(canvas.height - point.radius, point.posY);
	}
}

function AddPoints() {
	var offset = 0;
	console.log(numPoints, points.length);
	if (points.length > numPoints) {
		offset = 1;
		points.pop();
		points[points.length - 1].siblings.pop();
	} else {
		var newPoint: Point = {
			posX: canvas.width / 2,
			posY: canvas.height / 2,
			radius: points[0].radius,
			prevX: canvas.width / 2,
			prevY: canvas.height / 2,
			inertiaX: 0,
			inertiaY: 0,
			locked: false,
			index: points.length + 1,
			siblings: [points[points.length - 1]],
		};

		points[points.length - 1].siblings.push(newPoint);

		points.push(newPoint);
	}
}
