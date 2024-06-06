const create = (tag) => document.createElement(tag);

export class DirTree {
  tree = {};

  constructor(
    files = [],
    { getFileValue = (filename) => filename, ignore = [] } = {}
  ) {
    files.forEach((file) => this.addFile(file, getFileValue, ignore));
    DirTree.sort(this.tree);
  }

  addFile(file, valuator = () => {}, ignore = []) {
    const parts = file.split(`/`);
    let curr = this.tree;
    while (parts.length > 1) {
      const part = parts.shift();
      if (ignore.includes(part)) return;
      curr[part] ??= {};
      curr = curr[part];
    }
    if (ignore.includes(file)) return;
    curr[parts[0]] = valuator(file);
  }

  flat(tree = this.tree, list = [], prefix = ``) {
    Object.entries(tree).forEach(([key, value]) => {
      if (typeof value === `object`) {
        return this.flat(value, list, prefix + (prefix ? `/` : ``) + key);
      }
      list.push(prefix + (prefix ? `/` : ``) + key);
    });
    return list;
  }

  static sort(sortable) {
    // this is really more of a "move dirs up" sort
    Object.entries(sortable).forEach(([key, value]) => {
      if (typeof value === `object`) {
        sortable[key] = this.sort(value);
      } else {
        delete sortable[key];
        sortable[key] = value;
      }
    });
    return sortable;
  }

  addToPage(clickHandler, parent, tree = this.tree, prefix = ``) {
    Object.entries(tree).forEach(([key, value]) => {
      const isDir = typeof value === `object`;
      const item = create(`li`);
      item.title = key;
      item.textContent = key;
      item.classList.add(isDir ? `dir` : `file`);
      parent.appendChild(item);
      const newPrefix = prefix + (prefix ? `/` : ``) + key;
      if (!isDir) {
        const btn = create(`button`);
        btn.textContent = `🗑️`;
        btn.title = `Delete`;
        item.appendChild(btn);
        btn.addEventListener(`click`, (e) => {
          e.stopPropagation();
          const sure = confirm(
            `Are you sure you want to delete ${key}?\nThe only way to restore is by rewinding!`
          );
          if (sure) {
            fetch(`/delete/${newPrefix}`, { method: `delete` });
            item.remove();
          }
        });
        item.addEventListener(`click`, () => clickHandler(newPrefix));
      } else {
        const list = create(`ul`);
        list.classList.add(key);
        item.appendChild(list);
        this.addToPage(clickHandler, list, value, newPrefix);
      }
    });
  }

  createNewFile(filename, clickHandler, parent) {
    const parts = filename.split(`/`);
    while (parts.length > 1) {
      const dirname = parts.shift();
      let ul = parent.querySelector(`& > li ul.${dirname}`);
      if (!ul) {
        const item = create(`li`);
        item.title = dirname;
        item.textContent = dirname;
        item.classList.add(`dir`);
        parent.appendChild(item);
        ul = create(`ul`);
        item.appendChild(ul);
      }
      parent = ul;
    }
    const item = create(`li`);
    item.title = parts[0];
    item.textContent = parts[0];
    item.classList.add(`file`);
    item.addEventListener(`click`, () => clickHandler(filename));
    parent.appendChild(item);
  }
}
