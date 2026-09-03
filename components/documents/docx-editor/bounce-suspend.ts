// Спільний прапорець: призупинення form-fill «відскоку» каретки на час
// програмного заповнення підпису (щоб bounce не перехоплював sélection-зміни).
const state = { active: false }

export const bounceSuspend = {
  begin() {
    state.active = true
  },
  end() {
    state.active = false
  },
  get active() {
    return state.active
  },
}
