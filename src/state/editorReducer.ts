import type { Rect } from '../lib/detector/types'
import { DEFAULT_EFFECT, type EffectOptions } from '../lib/effects/render'
import { newFaceId, newFacesOnly, type Face } from '../lib/faces'
import type { LoadedImage } from '../lib/image/load'

export type Status = 'idle' | 'loading' | 'detecting' | 'ready'

export interface EditorState {
  status: Status
  image: LoadedImage | null
  faces: Face[]
  selectedId: string | null
  effect: EffectOptions
  /** 감지 진행률 0~1 */
  progress: number
  /** 정밀 감지(작은 얼굴 더 찾기)를 이미 돌렸는지 */
  preciseDone: boolean
  error: string | null
}

export const initialState: EditorState = {
  status: 'idle',
  image: null,
  faces: [],
  selectedId: null,
  effect: DEFAULT_EFFECT,
  progress: 0,
  preciseDone: false,
  error: null,
}

export type Action =
  | { type: 'load-start' }
  | { type: 'load-done'; image: LoadedImage }
  | { type: 'fail'; error: string }
  | { type: 'progress'; progress: number }
  | { type: 'detect-done'; faces: Face[] }
  | { type: 'precise-start' }
  | { type: 'precise-done'; faces: Face[] }
  | { type: 'toggle'; id: string }
  | { type: 'select'; id: string | null }
  | { type: 'add'; rect: Rect }
  | { type: 'update-rect'; id: string; rect: Rect }
  | { type: 'remove'; id: string }
  | { type: 'set-all'; enabled: boolean }
  | { type: 'effect'; patch: Partial<EffectOptions> }
  | { type: 'reset' }
  | { type: 'dismiss-error' }

export function editorReducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'load-start':
      return { ...initialState, effect: state.effect, status: 'loading' }
    case 'load-done':
      return { ...state, status: 'detecting', image: action.image, progress: 0 }
    case 'fail':
      // 사진이 이미 열려 있으면 편집은 계속할 수 있게 ready로, 아니면 처음 화면으로
      return { ...state, status: state.image ? 'ready' : 'idle', error: action.error }
    case 'progress':
      return { ...state, progress: action.progress }
    case 'detect-done':
      return { ...state, status: 'ready', faces: action.faces, progress: 1 }
    case 'precise-start':
      return { ...state, status: 'detecting', progress: 0 }
    case 'precise-done':
      return {
        ...state,
        status: 'ready',
        progress: 1,
        preciseDone: true,
        faces: [...state.faces, ...newFacesOnly(state.faces, action.faces)],
      }
    case 'toggle':
      return { ...state, faces: state.faces.map((f) => (f.id === action.id ? { ...f, enabled: !f.enabled } : f)) }
    case 'select':
      return { ...state, selectedId: action.id }
    case 'add': {
      const face: Face = { ...action.rect, id: newFaceId(), enabled: true, source: 'manual' }
      return { ...state, faces: [...state.faces, face], selectedId: face.id }
    }
    case 'update-rect':
      return { ...state, faces: state.faces.map((f) => (f.id === action.id ? { ...f, ...action.rect } : f)) }
    case 'remove':
      return {
        ...state,
        faces: state.faces.filter((f) => f.id !== action.id),
        selectedId: state.selectedId === action.id ? null : state.selectedId,
      }
    case 'set-all':
      return { ...state, faces: state.faces.map((f) => ({ ...f, enabled: action.enabled })) }
    case 'effect':
      return { ...state, effect: { ...state.effect, ...action.patch } }
    case 'reset':
      return { ...initialState, effect: state.effect }
    case 'dismiss-error':
      return { ...state, error: null }
  }
}
