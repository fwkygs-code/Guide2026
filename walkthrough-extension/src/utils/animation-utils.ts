export class AnimationUtils {
  static async animateElement(
    element: HTMLElement,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions
  ): Promise<void> {
    return new Promise((resolve) => {
      const animation = element.animate(keyframes, options);
      
      animation.onfinish = () => {
        resolve();
      };
      
      animation.oncancel = () => {
        resolve();
      };
    });
  }
  
  static async fadeIn(
    element: HTMLElement,
    duration: number = 300,
    easing: string = 'ease-in-out'
  ): Promise<void> {
    element.style.opacity = '0';
    element.style.display = 'block';
    
    await this.animateElement(
      element,
      [
        { opacity: 0 },
        { opacity: 1 }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
  }
  
  static async fadeOut(
    element: HTMLElement,
    duration: number = 300,
    easing: string = 'ease-in-out'
  ): Promise<void> {
    await this.animateElement(
      element,
      [
        { opacity: 1 },
        { opacity: 0 }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
    
    element.style.display = 'none';
  }
  
  static async slideIn(
    element: HTMLElement,
    direction: 'up' | 'down' | 'left' | 'right' = 'down',
    duration: number = 300,
    easing: string = 'ease-out'
  ): Promise<void> {
    const transforms = {
      up: 'translateY(-100%)',
      down: 'translateY(100%)',
      left: 'translateX(-100%)',
      right: 'translateX(100%)'
    };
    
    element.style.transform = transforms[direction];
    element.style.display = 'block';
    
    await this.animateElement(
      element,
      [
        { transform: transforms[direction] },
        { transform: 'translate(0, 0)' }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
  }
  
  static async slideOut(
    element: HTMLElement,
    direction: 'up' | 'down' | 'left' | 'right' = 'down',
    duration: number = 300,
    easing: string = 'ease-in'
  ): Promise<void> {
    const transforms = {
      up: 'translateY(-100%)',
      down: 'translateY(100%)',
      left: 'translateX(-100%)',
      right: 'translateX(100%)'
    };
    
    await this.animateElement(
      element,
      [
        { transform: 'translate(0, 0)' },
        { transform: transforms[direction] }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
    
    element.style.display = 'none';
  }
  
  static async scaleIn(
    element: HTMLElement,
    fromScale: number = 0.8,
    duration: number = 300,
    easing: string = 'ease-out'
  ): Promise<void> {
    element.style.transform = `scale(${fromScale})`;
    element.style.display = 'block';
    
    await this.animateElement(
      element,
      [
        { transform: `scale(${fromScale})`, opacity: 0 },
        { transform: 'scale(1)', opacity: 1 }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
  }
  
  static async scaleOut(
    element: HTMLElement,
    toScale: number = 0.8,
    duration: number = 300,
    easing: string = 'ease-in'
  ): Promise<void> {
    await this.animateElement(
      element,
      [
        { transform: 'scale(1)', opacity: 1 },
        { transform: `scale(${toScale})`, opacity: 0 }
      ],
      {
        duration,
        easing,
        fill: 'forwards'
      }
    );
    
    element.style.display = 'none';
  }
  
  static async pulse(
    element: HTMLElement,
    scale: number = 1.1,
    duration: number = 200,
    iterations: number = 1
  ): Promise<void> {
    await this.animateElement(
      element,
      [
        { transform: 'scale(1)' },
        { transform: `scale(${scale})` },
        { transform: 'scale(1)' }
      ],
      {
        duration,
        iterations,
        easing: 'ease-in-out'
      }
    );
  }
  
  static async shake(
    element: HTMLElement,
    intensity: number = 10,
    duration: number = 500
  ): Promise<void> {
    await this.animateElement(
      element,
      [
        { transform: 'translateX(0)' },
        { transform: `translateX(-${intensity}px)` },
        { transform: `translateX(${intensity}px)` },
        { transform: `translateX(-${intensity}px)` },
        { transform: `translateX(${intensity}px)` },
        { transform: `translateX(-${intensity}px)` },
        { transform: `translateX(${intensity}px)` },
        { transform: 'translateX(0)' }
      ],
      {
        duration,
        easing: 'ease-in-out'
      }
    );
  }
  
  static async bounce(
    element: HTMLElement,
    height: number = 20,
    duration: number = 600
  ): Promise<void> {
    await this.animateElement(
      element,
      [
        { transform: 'translateY(0)' },
        { transform: `translateY(-${height}px)` },
        { transform: 'translateY(0)' },
        { transform: `translateY(-${height / 2}px)` },
        { transform: 'translateY(0)' }
      ],
      {
        duration,
        easing: 'ease-out'
      }
    );
  }
  
  static createGlowEffect(
    element: HTMLElement,
    color: string = '#ffffff',
    size: number = 20,
    duration: number = 1000
  ): void {
    const glowKeyframes = [
      { 
        boxShadow: `0 0 ${size}px ${color}`,
        filter: `brightness(1.2)`
      },
      { 
        boxShadow: `0 0 ${size * 2}px ${color}`,
        filter: `brightness(1.4)`
      },
      { 
        boxShadow: `0 0 ${size}px ${color}`,
        filter: `brightness(1.2)`
      }
    ];
    
    element.animate(glowKeyframes, {
      duration,
      iterations: Infinity,
      easing: 'ease-in-out'
    });
  }
  
  static removeGlowEffect(element: HTMLElement): void {
    const animations = element.getAnimations();
    animations.forEach(animation => {
      if (animation.effect) {
        try {
          const keyframes = (animation.effect as any).getKeyframes();
          if (keyframes.some((keyframe: any) => 
            keyframe.boxShadow || keyframe.filter
          )) {
            animation.cancel();
          }
        } catch (error) {
          // Fallback: cancel if we can't check keyframes
          animation.cancel();
        }
      }
    });
    
    element.style.boxShadow = '';
    element.style.filter = '';
  }
  
  static async transitionStyle(
    element: HTMLElement,
    properties: Record<string, string>,
    duration: number = 300,
    easing: string = 'ease-in-out'
  ): Promise<void> {
    const originalTransition = element.style.transition;
    
    element.style.transition = `all ${duration}ms ${easing}`;
    
    Object.entries(properties).forEach(([property, value]) => {
      (element.style as any)[property] = value;
    });
    
    return new Promise((resolve) => {
      const handleTransitionEnd = () => {
        element.removeEventListener('transitionend', handleTransitionEnd);
        element.style.transition = originalTransition;
        resolve();
      };
      
      element.addEventListener('transitionend', handleTransitionEnd);
      
      // Fallback timeout
      setTimeout(() => {
        element.removeEventListener('transitionend', handleTransitionEnd);
        element.style.transition = originalTransition;
        resolve();
      }, duration + 100);
    });
  }
  
  static debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: number;
    
    return (...args: Parameters<T>) => {
      clearTimeout(timeout);
      timeout = window.setTimeout(() => func(...args), wait);
    };
  }
  
  static throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  static waitForNextFrame(): Promise<void> {
    return new Promise(resolve => {
      requestAnimationFrame((time: number) => {
        resolve();
      });
    });
  }
  
  static waitForFrames(count: number): Promise<void> {
    return new Promise(resolve => {
      let frameCount = 0;
      
      const checkFrame = () => {
        frameCount++;
        if (frameCount >= count) {
          resolve();
        } else {
          requestAnimationFrame(checkFrame);
        }
      };
      
      requestAnimationFrame(checkFrame);
    });
  }
  
  static getAnimationDuration(element: HTMLElement): number {
    const style = window.getComputedStyle(element);
    const duration = style.animationDuration || style.transitionDuration;
    
    if (duration === '0s' || !duration) {
      return 0;
    }
    
    // Convert to milliseconds
    const value = parseFloat(duration);
    const unit = duration.replace(/[0-9.]/g, '');
    
    return unit === 's' ? value * 1000 : value;
  }
  
  static isAnimating(element: HTMLElement): boolean {
    return element.getAnimations().length > 0;
  }
  
  static stopAllAnimations(element: HTMLElement): void {
    const animations = element.getAnimations();
    animations.forEach(animation => {
      animation.cancel();
    });
  }
}
