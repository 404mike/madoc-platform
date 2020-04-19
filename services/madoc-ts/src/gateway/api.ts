import { fetchJson } from './fetch-json';
import { BaseTask } from '../tasks/base-task';

export class ApiClient {
  private readonly gateway: string;
  private readonly jwt: string;

  constructor(gateway: string, jwt: string) {
    this.gateway = gateway;
    this.jwt = jwt;
  }

  request<Return>(
    endpoint: string,
    {
      method = 'GET',
      body,
      jwt = this.jwt,
    }: { method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD'; body?: any; jwt?: string } = {}
  ): Promise<Return> {
    return fetchJson(this.gateway, endpoint, {
      method,
      body,
      jwt,
    });
  }

  // IIIF.
  async getCollections(page = 0) {
    return this.request<{
      collections: Array<any>;
      nextPage: boolean;
      page: number;
    }>(`/api/madoc/iiif/collections${page ? `?page=${page}` : ''}`);
  }
  async getCollectionById(id: number, page: number) {
    return this.request<any>(`/api/madoc/iiif/collection/${id}${page ? `?page=${page}` : ''}`);
  }
  async getManifestById(id: string, page: number) {
    // @todo.
  }
  async importCollection(id: string) {
    // @todo.
  }
  async importManifest(id: string) {
    // @todo.
  }
  async getCanvasById(manifestId: string, id: string) {
    // @todo
  }

  // Tasks.
  async getTaskById<Task extends BaseTask>(id: string): Promise<Task> {
    return this.request<Task>(`/api/tasks/${id}`);
  }

  async getTasksBySubject<Task extends BaseTask>(subject: string) {
    // @todo.
  }

  async getTasksByType<Task extends BaseTask>(type: Task['type']) {
    // @todo.
  }

  async updateTask<Task extends BaseTask>(id: string | undefined, task: Partial<Task>) {
    if (!id) {
      throw new Error('Task could not be updated');
    }
    return this.request<Task>(`/api/tasks/${id}`, {
      method: 'PATCH',
      body: task,
    });
  }

  async getTasks(jwt?: string): Promise<BaseTask[]> {
    return this.request(`/api/tasks`, { jwt });
  }

  async acceptTask<Task extends BaseTask>(id: string): Promise<Task> {
    return this.request(`/api/tasks/${id}/accept`, {
      method: 'POST',
    });
  }

  async newTask<Task extends BaseTask>(task: Partial<Task>, parentId?: string, customJwt?: string) {
    return this.request<Task>(parentId ? `/api/tasks/${parentId}/subtasks` : `/api/tasks`, {
      method: 'POST',
      body: task,
      jwt: customJwt,
    });
  }

  async addSubtasks<Task extends BaseTask>(tasks: Partial<Task>[], parentId: string) {
    return this.request<Task>(`/api/tasks/${parentId}/subtasks`, {
      method: 'POST',
      body: tasks,
    });
  }
}
