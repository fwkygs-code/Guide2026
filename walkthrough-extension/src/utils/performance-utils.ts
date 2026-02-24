export class PerformanceUtils {
  private static performanceMarks: Map<string, number> = new Map();
  private static performanceMeasures: Map<string, number[]> = new Map();
  
  static startMark(name: string): void {
    this.performanceMarks.set(name, performance.now());
  }
  
  static endMark(name: string): number {
    const startTime = this.performanceMarks.get(name);
    if (!startTime) {
      console.warn(`Performance mark "${name}" not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.performanceMarks.delete(name);
    
    // Store measure
    if (!this.performanceMeasures.has(name)) {
      this.performanceMeasures.set(name, []);
    }
    this.performanceMeasures.get(name)!.push(duration);
    
    return duration;
  }
  
  static getAverageMeasure(name: string): number {
    const measures = this.performanceMeasures.get(name);
    if (!measures || measures.length === 0) {
      return 0;
    }
    
    return measures.reduce((sum, measure) => sum + measure, 0) / measures.length;
  }
  
  static getTotalMeasure(name: string): number {
    const measures = this.performanceMeasures.get(name);
    if (!measures) {
      return 0;
    }
    
    return measures.reduce((sum, measure) => sum + measure, 0);
  }
  
  static clearMeasures(name?: string): void {
    if (name) {
      this.performanceMeasures.delete(name);
    } else {
      this.performanceMeasures.clear();
    }
  }
  
  static measureFunction<T extends (...args: any[]) => any>(
    fn: T,
    measureName: string
  ): (...args: Parameters<T>) => ReturnType<T> {
    return (...args: Parameters<T>): ReturnType<T> => {
      this.startMark(measureName);
      const result = fn(...args);
      this.endMark(measureName);
      return result;
    };
  }
  
  static measureAsyncFunction<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    measureName: string
  ): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
    return async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
      this.startMark(measureName);
      const result = await fn(...args);
      this.endMark(measureName);
      return result;
    };
  }
  
  static getMemoryUsage(): {
    used: number;
    total: number;
    limit: number;
  } {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      return {
        used: memory.usedJSHeapSize,
        total: memory.totalJSHeapSize,
        limit: memory.jsHeapSizeLimit
      };
    }
    
    return { used: 0, total: 0, limit: 0 };
  }
  
  static getFPS(): number {
    let lastTime = performance.now();
    let frames = 0;
    let fps = 0;
    
    const countFrames = (currentTime: number) => {
      frames++;
      
      if (currentTime >= lastTime + 1000) {
        fps = Math.round((frames * 1000) / (currentTime - lastTime));
        frames = 0;
        lastTime = currentTime;
      }
      
      requestAnimationFrame(countFrames);
    };
    
    requestAnimationFrame(countFrames);
    return fps;
  }
  
  static getDOMStats(): {
    totalNodes: number;
    textNodes: number;
    elementNodes: number;
    commentNodes: number;
    maxDepth: number;
  } {
    const allNodes = document.querySelectorAll('*');
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ALL
    );
    
    let totalNodes = 0;
    let textNodes = 0;
    let elementNodes = 0;
    let commentNodes = 0;
    let maxDepth = 0;
    
    const traverse = (node: Node, depth: number) => {
      totalNodes++;
      maxDepth = Math.max(maxDepth, depth);
      
      switch (node.nodeType) {
        case Node.ELEMENT_NODE:
          elementNodes++;
          break;
        case Node.TEXT_NODE:
          textNodes++;
          break;
        case Node.COMMENT_NODE:
          commentNodes++;
          break;
      }
      
      let child = node.firstChild;
      while (child) {
        traverse(child, depth + 1);
        child = child.nextSibling;
      }
    };
    
    traverse(document.body, 0);
    
    return {
      totalNodes,
      textNodes,
      elementNodes,
      commentNodes,
      maxDepth
    };
  }
  
  static estimateEventListeners(): number {
    // This is a rough estimation since we can't directly count event listeners
    const elements = document.querySelectorAll('*');
    let estimatedListeners = 0;
    
    elements.forEach(element => {
      // Estimate based on common event-prone elements
      const tagName = element.tagName.toLowerCase();
      if (['button', 'input', 'a', 'form', 'select', 'textarea'].includes(tagName)) {
        estimatedListeners += 2; // Average 2 listeners per interactive element
      } else if (['div', 'span', 'p', 'section', 'article'].includes(tagName)) {
        estimatedListeners += 0.5; // Average 0.5 listeners per container element
      }
    });
    
    return Math.round(estimatedListeners);
  }
  
  static getRenderTime(): number {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    if (navigation) {
      return navigation.loadEventEnd - navigation.loadEventStart;
    }
    return 0;
  }
  
  static getPaintTiming(): {
    firstPaint: number;
    firstContentfulPaint: number;
    firstMeaningfulPaint?: number;
  } {
    const paintEntries = performance.getEntriesByType('paint');
    const result = {
      firstPaint: 0,
      firstContentfulPaint: 0
    } as any;
    
    paintEntries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        result.firstPaint = entry.startTime;
      } else if (entry.name === 'first-contentful-paint') {
        result.firstContentfulPaint = entry.startTime;
      }
    });
    
    return result;
  }
  
  static getResourceTiming(): {
    totalResources: number;
    totalSize: number;
    cachedResources: number;
    slowResources: Array<{ name: string; duration: number }>;
  } {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    const slowThreshold = 1000; // 1 second
    
    let totalSize = 0;
    let cachedResources = 0;
    const slowResources: Array<{ name: string; duration: number }> = [];
    
    resources.forEach(resource => {
      // Estimate size (this is approximate)
      if (resource.transferSize) {
        totalSize += resource.transferSize;
      }
      
      if (resource.transferSize === 0 && resource.decodedBodySize > 0) {
        cachedResources++;
      }
      
      if (resource.duration > slowThreshold) {
        slowResources.push({
          name: resource.name,
          duration: resource.duration
        });
      }
    });
    
    return {
      totalResources: resources.length,
      totalSize,
      cachedResources,
      slowResources
    };
  }
  
  static createPerformanceReport(): {
    timestamp: number;
    memory: any;
    fps: number;
    dom: any;
    render: number;
    paint: any;
    resources: any;
    customMeasures: Record<string, { average: number; total: number; count: number }>;
  } {
    const customMeasures: Record<string, { average: number; total: number; count: number }> = {};
    
    this.performanceMeasures.forEach((measures, name) => {
      customMeasures[name] = {
        average: this.getAverageMeasure(name),
        total: this.getTotalMeasure(name),
        count: measures.length
      };
    });
    
    return {
      timestamp: Date.now(),
      memory: this.getMemoryUsage(),
      fps: this.getFPS(),
      dom: this.getDOMStats(),
      render: this.getRenderTime(),
      paint: this.getPaintTiming(),
      resources: this.getResourceTiming(),
      customMeasures
    };
  }
  
  static monitorPerformance(
    interval: number = 5000,
    callback: (report: any) => void
  ): () => void {
    const intervalId = setInterval(() => {
      const report = this.createPerformanceReport();
      callback(report);
    }, interval);
    
    return () => clearInterval(intervalId);
  }
  
  static checkPerformanceThresholds(thresholds: {
    maxMemory?: number;
    minFPS?: number;
    maxDOMNodes?: number;
    maxRenderTime?: number;
  }): {
    passed: boolean;
    violations: Array<{ metric: string; current: number; threshold: number }>;
  } {
    const violations: Array<{ metric: string; current: number; threshold: number }> = [];
    
    const memory = this.getMemoryUsage();
    if (thresholds.maxMemory && memory.used > thresholds.maxMemory) {
      violations.push({
        metric: 'memory',
        current: memory.used,
        threshold: thresholds.maxMemory
      });
    }
    
    const fps = this.getFPS();
    if (thresholds.minFPS && fps < thresholds.minFPS) {
      violations.push({
        metric: 'fps',
        current: fps,
        threshold: thresholds.minFPS
      });
    }
    
    const dom = this.getDOMStats();
    if (thresholds.maxDOMNodes && dom.totalNodes > thresholds.maxDOMNodes) {
      violations.push({
        metric: 'domNodes',
        current: dom.totalNodes,
        threshold: thresholds.maxDOMNodes
      });
    }
    
    const renderTime = this.getRenderTime();
    if (thresholds.maxRenderTime && renderTime > thresholds.maxRenderTime) {
      violations.push({
        metric: 'renderTime',
        current: renderTime,
        threshold: thresholds.maxRenderTime
      });
    }
    
    return {
      passed: violations.length === 0,
      violations
    };
  }
}
