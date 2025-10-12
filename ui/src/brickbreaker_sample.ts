import { everyTick, getMousePosition, onKeyDown, onKeyUp, onPause, onResume, periodically, setBackground, setBoardSize, whenLoaded, boardWidth } from "./lib/simplegame";
import { createText, Effect, EffectClass, Enemy, EnemyClass, GameObject, ItemClass, Player, PlayerClass, ProjectileClass } from "./lib/gameclasses";
import { midpoint, scaleVector } from "./lib/util";
import { Music, SoundEffect } from "./lib/audio";
import { CollisionDetector } from "./lib/collision";

export function setup_brickbreaker() {
    setBoardSize(1000, 1000);

    // Define game classes
    const ballClass = new ItemClass("ball", "ball-1.png");
    ballClass.setDefaultSpeed(800);
    ballClass.defaultWidth = 30;
    ballClass.defaultHeight = 30;

    const paddleClass = new PlayerClass("paddle", "paddle-1.png");
    paddleClass.defaultSpeed = 800;
    paddleClass.defaultWidth = 150;
    paddleClass.defaultHeight = 30;


    const brickClasses: EnemyClass[] = [];
    for (let i = 1; i <= 6; i++) {
        const brickClass = new EnemyClass(`brick${i}`, `brick-${i}.png`, 1);
        brickClass.defaultWidth = 80;
        brickClass.defaultHeight = 30;
        brickClasses.push(brickClass);
    }

    const explosionClass = new EffectClass("explosion", "explosion.png", 300, 50, 100);

    // Audio
    const bounceSound = new SoundEffect("music/bounce.mp3");
    const breakSound = new SoundEffect("music/explosion.mp3");
    const music = new Music("music/pachelbel-canon.mp3");
    music.setVolume(0.3);

    onPause(() => music.pause());
    onResume(() => music.play());

    // Background
    setBackground(["background-1.png", "background-2.png", "background-3.png"]);

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
        paddle.speed = 1600;

        // Create ball
        ball = ballClass.spawn(paddle.x, paddle.y - 50);
        ball.setOrientation(-90); // Up
        ball.velocity = ball.speed;

        // Create bricks
        // Lay bricks using each brick's actual dimensions so they don't overlap
        const hGap = 1;
        const vGap = 1;
        const startX = 10;
        const startY = 10;
        // Compute how many bricks fit per row based on available board width and the widest brick
        const maxBrickWidth = Math.max(...brickClasses.map(bc => bc.defaultWidth || 0));
        const availableWidth = boardWidth - startX - startX;
        const bricksPerRow = Math.max(1, Math.floor((availableWidth + hGap) / (maxBrickWidth + hGap)));

        let yCursor = startY;
        for (let row = 0; row < 8; row++) {
            let xCursor = startX;
            let rowMaxHeight = 0;
            for (let col = 0; col < bricksPerRow; col++) {
                const brickClass = brickClasses[Math.floor(Math.random() * brickClasses.length)];
                // Spawn first, then use the actual object's width/height
                const brick = brickClass.spawn(0, 0);
                const brickWidth = brick.width;
                const brickHeight = brick.height;
                const x = xCursor + brickWidth / 2;
                const y = yCursor + brickHeight / 2;
                brick.setLocation(x, y);
                bricks.push(brick);
                xCursor += brickWidth + hGap;
                rowMaxHeight = Math.max(rowMaxHeight, brickHeight);
            }
            yCursor += rowMaxHeight + vGap;
        }

        // UI Text
        scoreText = createText(`Score: ${score}`, { x: 50, y: 50 });
        livesText = createText(`Lives: ${lives}`, { x: 800, y: 50 });

        // Set up collision handlers for ball
        ball.onCollisionWithEnemy(collide_ball_with_brick);

        ball.onCollisionWithParticular(paddle, (paddleObj: GameObject) => {
            collide_ball_with_paddle(ball, paddle);
        });

        // Ball movement and collision
        everyTick(() => {
            if (gameOver) return;

            // Ball collision with walls
            if (ball.x <= 0 || ball.x >= 1000) {
                ball.direction_x *= -1;
                bounceSound.play();
            }
            if (ball.y <= 0) {
                ball.direction_y *= -1;
                bounceSound.play();
            }
            if (ball.y >= 1000) {
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
                ball.setOrientation(-90);
                ball.velocity = ball.speed;
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
            move_paddle(paddle);
        });

        music.play();
    });
    
    function move_paddle(paddle: Player) {
        // Paddle moves towards mouse horizontally with velocity
        const mousePos = getMousePosition();
        const deltaX = mousePos.x - paddle.x;
        // console.log(`Paddle at ${paddle.x}, mouse at ${mousePos.x}, deltaX=${deltaX}`);
        if (deltaX > 0) {
            paddle.direction_x = 1;
            paddle.setSpeedX(paddle.speed *Math.min(1, deltaX/200)); // Scale velocity towards mouse
        } else if (deltaX < 0) {
            paddle.direction_x = -1;
            paddle.setSpeedX(paddle.speed * Math.max(-1, deltaX/200)); // Scale velocity towards mouse
        } else {
            paddle.velocity = 0;
        }
        
        // Check if paddle is against the side in the direction of orientation and stop velocity
        if (paddle.direction_x > 0 && paddle.x + paddle.width / 2 >= 1000) {
            paddle.velocity = 0;
            paddle.x_speed = 0;
        } else if (paddle.direction_x < 0 && paddle.x - paddle.width / 2 <= 0) {
            paddle.velocity = 0;
            paddle.x_speed = 0;
        }
    }
    
    function collide_ball_with_paddle(ball: any, paddle: any) {
        const max_offset_degrees = 45;
        const fraction = paddle.x_speed / paddle.speed;
        const offset_degrees = fraction * max_offset_degrees;
        // Get current direction
        let reflected_dx = ball.direction_x;
        let reflected_dy = ball.direction_y;
        // Reflect on x-axis if going down (positive y direction)
        if (ball.direction_y > 0) {
            reflected_dy = -reflected_dy;
        }
        // Compute the reflected orientation
        const reflected_angle_radians = Math.atan2(reflected_dy, reflected_dx) + Math.PI / 2;
        // Modify the reflected orientation by the offset
        const offset_radians = offset_degrees * (Math.PI / 180);
        const new_angle_radians = reflected_angle_radians + offset_radians;
        ball.setOrientationRadians(new_angle_radians);
        ball.velocity = ball.speed;
        // Move the ball directly above the paddle without overlapping
        ball.y = paddle.y - paddle.height / 2 - ball.height / 2;
        bounceSound.play();
    }

    function collide_ball_with_brick(enemy: Enemy) {
        // Collision with brick (enemy)
        // Compute reflection based on the closest point on the brick to the ball center
        const left = enemy.x - enemy.width / 2;
        const right = enemy.x + enemy.width / 2;
        const top = enemy.y - enemy.height / 2;
        const bottom = enemy.y + enemy.height / 2;
        const closest_x = Math.max(left, Math.min(ball.x, right));
        const closest_y = Math.max(top, Math.min(ball.y, bottom));
        const dx = ball.x - closest_x;
        const dy = ball.y - closest_y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist === 0) return; // Avoid division by zero, though unlikely
        const n_x = dx / dist;
        const n_y = dy / dist;
        const dot = ball.direction_x * n_x + ball.direction_y * n_y;
        const reflected_x = ball.direction_x - 2 * dot * n_x;
        const reflected_y = ball.direction_y - 2 * dot * n_y;
        const angle = Math.atan2(reflected_y, reflected_x) + Math.PI / 2;
        ball.setOrientationRadians(angle);
        
        enemy.takeDamage(1);
        score += 10;
        scoreText.text = `Score: ${score}`;
        breakSound.play();
        const explosion = explosionClass.spawnAt(enemy);
        explosion.width = 80;
        explosion.height = 40;
        bricks = bricks.filter(b => b !== enemy);
    }
}
