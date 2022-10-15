export default interface IModel {
    save: () => Promise<any>;
    destroy: () => Promise<any>
}