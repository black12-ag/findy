import React from 'react';

export interface CameraOptions {
  width?: number;
  height?: number;
  facingMode?: 'user' | 'environment';
  audio?: boolean;
  video?: boolean;
}

export interface PhotoCaptureOptions {
  quality?: number; // 0-1
  width?: number;
  height?: number;
  format?: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface QRCodeResult {
  text: string;
  format: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export type CameraPermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

class CameraService {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private context: CanvasRenderingContext2D | null = null;
  private isStreamActive: boolean = false;
  private qrCodeScanner: any = null; // Will be set when QR scanner is initialized

  /**
   * Check if camera API is supported
   */
  isSupported(): boolean {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Check camera permission status
   */
  async getPermissionStatus(): Promise<CameraPermissionStatus> {
    if (!this.isSupported()) {
      return 'unsupported';
    }

    // Try to use Permissions API if available
    if ('permissions' in navigator) {
      try {
        const permission = await navigator.permissions.query({ name: 'camera' as PermissionName });
        return permission.state as CameraPermissionStatus;
      } catch (error) {
        console.warn('Camera permissions API not fully supported:', error);
      }
    }

    // Fallback: Try to access camera briefly to check permission
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false 
      });
      // Immediately stop the stream
      stream.getTracks().forEach(track => track.stop());
      return 'granted';
    } catch (error: any) {
      if (error.name === 'NotAllowedError') {
        return 'denied';
      } else if (error.name === 'NotFoundError') {
        return 'unsupported';
      }
      return 'prompt';
    }
  }

  /**
   * Request camera permission and initialize camera
   */
  async requestPermission(options: CameraOptions = {}): Promise<CameraPermissionStatus> {
    if (!this.isSupported()) {
      throw new Error('Camera is not supported by this browser');
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          width: options.width || 1280,
          height: options.height || 720,
          facingMode: options.facingMode || 'environment' // Rear camera for AR
        },
        audio: options.audio || false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      return 'granted';
    } catch (error: any) {
      switch (error.name) {
        case 'NotAllowedError':
          return 'denied';
        case 'NotFoundError':
        case 'DevicesNotFoundError':
          throw new Error('No camera device found');
        case 'NotSupportedError':
        case 'ConstraintNotSatisfiedError':
          throw new Error('Camera constraints not supported');
        case 'NotReadableError':
          throw new Error('Camera is already in use');
        default:
          throw new Error(`Camera error: ${error.message}`);
      }
    }
  }

  /**
   * Start camera stream and attach to video element
   */
  async startCamera(videoElement: HTMLVideoElement, options: CameraOptions = {}): Promise<void> {
    if (this.isStreamActive) {
      console.warn('Camera is already active');
      return;
    }

    const permissionStatus = await this.requestPermission(options);
    if (permissionStatus !== 'granted' || !this.stream) {
      throw new Error('Camera permission not granted or stream not available');
    }

    this.videoElement = videoElement;
    this.videoElement.srcObject = this.stream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    await new Promise<void>((resolve, reject) => {
      const onLoadedMetadata = () => {
        this.videoElement!.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.videoElement!.removeEventListener('error', onError);
        this.isStreamActive = true;
        resolve();
      };

      const onError = (error: Event) => {
        this.videoElement!.removeEventListener('loadedmetadata', onLoadedMetadata);
        this.videoElement!.removeEventListener('error', onError);
        reject(new Error('Failed to start camera'));
      };

      this.videoElement!.addEventListener('loadedmetadata', onLoadedMetadata);
      this.videoElement!.addEventListener('error', onError);
    });

    // Initialize canvas for photo capture
    this.initializeCanvas();
  }

  /**
   * Stop camera stream
   */
  stopCamera(): void {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    this.isStreamActive = false;
    this.canvas = null;
    this.context = null;
  }

  /**
   * Check if camera is currently active
   */
  isActive(): boolean {
    return this.isStreamActive && this.stream !== null;
  }

  /**
   * Capture photo from current video stream
   */
  async capturePhoto(options: PhotoCaptureOptions = {}): Promise<string> {
    if (!this.isStreamActive || !this.videoElement || !this.canvas || !this.context) {
      throw new Error('Camera is not active');
    }

    const video = this.videoElement;
    const canvas = this.canvas;
    const ctx = this.context;

    // Set canvas dimensions
    canvas.width = options.width || video.videoWidth;
    canvas.height = options.height || video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to data URL
    const format = options.format || 'image/jpeg';
    const quality = options.quality || 0.9;
    
    return canvas.toDataURL(format, quality);
  }

  /**
   * Capture photo as Blob (for uploading)
   */
  async capturePhotoAsBlob(options: PhotoCaptureOptions = {}): Promise<Blob> {
    if (!this.isStreamActive || !this.videoElement || !this.canvas || !this.context) {
      throw new Error('Camera is not active');
    }

    const video = this.videoElement;
    const canvas = this.canvas;
    const ctx = this.context;

    // Set canvas dimensions
    canvas.width = options.width || video.videoWidth;
    canvas.height = options.height || video.videoHeight;

    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to capture photo as blob'));
          }
        },
        options.format || 'image/jpeg',
        options.quality || 0.9
      );
    });
  }

  /**
   * Switch between front and rear camera
   */
  async switchCamera(facingMode: 'user' | 'environment' = 'environment'): Promise<void> {
    if (!this.isStreamActive || !this.videoElement) {
      throw new Error('Camera is not active');
    }

    // Stop current stream
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
    }

    // Start new stream with different facing mode
    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: facingMode
        },
        audio: false
      };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.videoElement.srcObject = this.stream;
    } catch (error: any) {
      throw new Error(`Failed to switch camera: ${error.message}`);
    }
  }

  /**
   * Get available camera devices
   */
  async getCameraDevices(): Promise<MediaDeviceInfo[]> {
    if (!this.isSupported()) {
      return [];
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'videoinput');
    } catch (error) {
      console.error('Failed to enumerate camera devices:', error);
      return [];
    }
  }

  /**
   * Initialize QR code scanner (requires external library like jsQR)
   */
  initializeQRScanner(): void {
    // This would require a QR code scanning library like jsQR
    // For now, we'll create a placeholder
    // QR Scanner initialized (requires jsQR library)
  }

  /**
   * Scan for QR codes in current video frame
   */
  async scanQRCode(): Promise<QRCodeResult | null> {
    if (!this.isStreamActive || !this.videoElement || !this.canvas || !this.context) {
      throw new Error('Camera is not active');
    }

    // This is a placeholder - real implementation would use jsQR or similar
    // const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
    // const qrCode = jsQR(imageData.data, imageData.width, imageData.height);
    
    // For demo purposes, return null (no QR code found)
    return null;
  }

  /**
   * Take a photo with location metadata (for place photos)
   */
  async capturePhotoWithLocation(
    location?: { lat: number; lng: number },
    options: PhotoCaptureOptions = {}
  ): Promise<{
    photoDataUrl: string;
    location?: { lat: number; lng: number };
    timestamp: number;
  }> {
    const photoDataUrl = await this.capturePhoto(options);
    
    return {
      photoDataUrl,
      location,
      timestamp: Date.now()
    };
  }

  /**
   * Initialize canvas for photo capture
   */
  private initializeCanvas(): void {
    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
      this.context = this.canvas.getContext('2d');
    }
  }

  /**
   * Get camera capabilities (resolution, zoom, etc.)
   */
  async getCameraCapabilities(): Promise<MediaTrackCapabilities | null> {
    if (!this.stream) {
      return null;
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getCapabilities) {
      return videoTrack.getCapabilities();
    }

    return null;
  }

  /**
   * Apply camera settings (zoom, focus, etc.)
   */
  async applyCameraSettings(settings: MediaTrackConstraints): Promise<void> {
    if (!this.stream) {
      throw new Error('Camera is not active');
    }

    const videoTrack = this.stream.getVideoTracks()[0];
    if (videoTrack && videoTrack.applyConstraints) {
      try {
        await videoTrack.applyConstraints(settings);
      } catch (error: any) {
        throw new Error(`Failed to apply camera settings: ${error.message}`);
      }
    }
  }
}

// React hook for using camera
export const useCamera = (options: CameraOptions = {}) => {
  const [isActive, setIsActive] = React.useState(false);
  const [permissionStatus, setPermissionStatus] = React.useState<CameraPermissionStatus>('prompt');
  const [error, setError] = React.useState<Error | null>(null);
  const [devices, setDevices] = React.useState<MediaDeviceInfo[]>([]);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  React.useEffect(() => {
    const initCamera = async () => {
      try {
        const status = await cameraService.getPermissionStatus();
        setPermissionStatus(status);

        if (cameraService.isSupported()) {
          const cameraDevices = await cameraService.getCameraDevices();
          setDevices(cameraDevices);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Camera initialization failed'));
      }
    };

    initCamera();

    return () => {
      if (cameraService.isActive()) {
        cameraService.stopCamera();
        setIsActive(false);
      }
    };
  }, []);

  const startCamera = async () => {
    if (!videoRef.current) {
      throw new Error('Video element not available');
    }

    try {
      await cameraService.startCamera(videoRef.current, options);
      setIsActive(true);
      setError(null);
      
      const status = await cameraService.getPermissionStatus();
      setPermissionStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to start camera'));
      setIsActive(false);
    }
  };

  const stopCamera = () => {
    cameraService.stopCamera();
    setIsActive(false);
  };

  const capturePhoto = async (captureOptions?: PhotoCaptureOptions) => {
    try {
      return await cameraService.capturePhoto(captureOptions);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to capture photo'));
      throw err;
    }
  };

  const switchCamera = async (facingMode: 'user' | 'environment' = 'environment') => {
    try {
      await cameraService.switchCamera(facingMode);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to switch camera'));
      throw err;
    }
  };

  return {
    videoRef,
    isActive,
    permissionStatus,
    error,
    devices,
    isSupported: cameraService.isSupported(),
    startCamera,
    stopCamera,
    capturePhoto,
    switchCamera,
    scanQRCode: cameraService.scanQRCode.bind(cameraService),
    capturePhotoWithLocation: cameraService.capturePhotoWithLocation.bind(cameraService)
  };
};

export const cameraService = new CameraService();
export default cameraService;