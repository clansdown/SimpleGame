import { everyTick, getMousePosition, onKeyDown, onKeyUp, onPause, onResume, periodically, setBackground, whenLoaded } from "./lib/simplegame";
import { createText, Effect, EffectClass, Enemy, EnemyClass, GameObject, PlayerClass, ProjectileClass } from "./lib/gameclasses";
import { midpoint, scaleVector } from "./lib/util";
import { Music, SoundEffect } from "./lib/audio";

export function setup_brickbreaker() {
    // Define game classes
    const ballClass = new ProjectileClass("ball", "ball-1.png");
    ballClass.setDefaultSpeed(300);
    ballClass.setBoundingBox(20, 20);

    const paddleClass = new PlayerClass("paddle", "paddle-1.png");
    paddleClass.setBoundingBox(100, 20);

    const brickClasses: EnemyClass[] = [];
    for (let i = 1; i <= 6; i++) {
        const brickClass = new EnemyClass(`brick${i}`, `brick-${i}.png`, 1);
        brickClass.setBoundingBox(80, 40);
        brickClasses.push(brickClass);
    }

    const explosionClass = new EffectClass("explosion", "explosion.png", 300, 50, 100);

    // Audio
    const bounceSound = new SoundEffect("bounce.mp3");
    const breakSound = new SoundEffect("break.mp3");
    const music = new Music("background_music.mp3");
    music.setVolume(0.3);

    onPause(() => music.pause());
    onResume(() => music.play());

    // Background
    setBackground(["background-1.png"]);

    // Game state
    let score = 0;
    let lives = 3;
    let ball: any = null;
    let paddle: any = null;
    let bricks: Enemy[] = [];
    let scoreText: any = null;
    let livesText: any = null;
    let gameOver = false;

    whenLoaded(() => {
        // Create paddle
        paddle = paddleClass.spawn(500, 950);
        paddle.enableArrowKeysMovement();
        paddle.speed = 400;

        // Create ball
        ball = ballClass.spawnAt(paddle);
        ball.setOrientationRadians(-Math.PI / 2); // Up
        ball.velocity = ball.speed;

        // Create bricks
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col < 10; col++) {
                const brickClass = brickClasses[Math.floor(Math.random() * brickClasses.length)];
                const brick = brickClass.spawn(100 + col * 90, 100 + row * 50);
                bricks.push(brick);
            }
        }

        // UI Text
        scoreText = createText(`Score: ${score}`, { x: 50, y: 50 });
        livesText = createText(`Lives: ${lives}`, { x: 800, y: 50 });

        // Ball movement and collision
        everyTick(() => {
            if (gameOver) return;

            // Ball collision with walls
            if (ball.x <= 0 || ball.x >= 10000) {
                ball.direction_x *= -1;
                bounceSound.play();
            }
            if (ball.y <= 0) {
                ball.direction_y *= -1;
                bounceSound.play();
            }
            if (ball.y >= 10000) {
                // Ball fell off bottom
                lives--;
                livesText.text = `Lives: ${lives}`;
                if (lives <= 0) {
                    gameOver = true;
                    createText("Game Over", { x: 500, y: 500 });
                    return;
                }
                // Reset ball
                ball.setLocation(paddle.x, paddle.y - 50);
                ball.setOrientationRadians(-Math.PI / 2);
                ball.velocity = ball.speed;
            }

            // Ball collision with paddle
            if (ball.x >= paddle.x - 50 && ball.x <= paddle.x + 50 && ball.y >= paddle.y - 10 && ball.y <= paddle.y + 10) {
                ball.direction_y *= -1;
                bounceSound.play();
            }

            // Ball collision with bricks
            for (const brick of bricks) {
                if (ball.x >= brick.x - 40 && ball.x <= brick.x + 40 && ball.y >= brick.y - 20 && ball.y <= brick.y + 20) {
                    ball.direction_y *= -1;
                    brick.takeDamage(1);
                    score += 10;
                    scoreText.text = `Score: ${score}`;
                    breakSound.play();
                    const explosion = explosionClass.spawnAt(brick);
                    explosion.width = 80;
                    explosion.height = 40;
                    bricks = bricks.filter(b => b !== brick);
                    break;
                }
            }

            // Check win condition
            if (bricks.length === 0) {
                gameOver = true;
                createText("You Win!", { x: 500, y: 500 });
            }
        });

        // Paddle movement
        everyTick(() => {
            if (gameOver) return;
            // Paddle follows mouse horizontally
            const mousePos = getMousePosition();
            paddle.setLocation(mousePos.x, paddle.y);
        });

        music.play();
    });
}
