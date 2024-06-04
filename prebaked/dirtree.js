const create = (tag) => document.createElement(tag);

export class DirTree {
  tree = {};

  constructor(files = [], valuator = (filename) => filename) {
    files.forEach((file) => this.addFile(file, valuator));
    this.sort(this.tree);
  }

  addFile(file, valuator) {
    const parts = file.split(`/`);
    let curr = this.tree;
    while (parts.length > 1) {
      const part = parts.shift();
      curr[part] ??= {};
      curr = curr[part];
    }
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

  sort(o) {
    Object.entries(o).forEach(([key, value]) => {
      if (typeof value === `object`) {
        o[key] = this.sort(value);
      } else {
        delete o[key];
        o[key] = value;
      }
    });
    return o;
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
