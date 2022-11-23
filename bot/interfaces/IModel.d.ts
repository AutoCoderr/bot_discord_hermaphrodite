export default interface IModel {
    save: () => Promise<any>;
    remove: () => Promise<any>
}