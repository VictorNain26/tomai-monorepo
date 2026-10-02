import { usersRepository } from '../auth/index.js';
import { parentChildRepository } from './parent-child.repository.js';

export async function listChildren(parentId: string, options: { includeInactive?: boolean } = {}) {
  const childIds = await parentChildRepository.getChildIds(parentId);
  const children = await usersRepository.findByIds(childIds);
  return options.includeInactive ? children : children.filter((child) => child.isActive);
}
