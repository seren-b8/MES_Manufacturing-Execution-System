export interface ResponseFormat<T> {
  status: 'success' | 'error';
  message: string;
  data: T | [];
}
