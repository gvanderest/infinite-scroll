/*eslint no-console: "off"*/
import React from "react";
import _ from "lodash";

export const DEFAULT_ROW_HEIGHT = 20; // pixels
export const DEFAULT_VIEWPORT_HEIGHT = 400; // pixels
export const DEFAULT_OVERFLOW_RECORDS = 3; // number of pre- and post- records

let uniqueIdentifier = 0;

export default class InfiniteScroll extends React.Component {
    constructor(props) {
        super(props);

        this.uniqueId = ++uniqueIdentifier;
        this.state = {
            topIndex: 0,
            detectedRowHeight: null,
            viewportRecords: []
        };
    }
    getRowHeight() {
        return this.state.rowHeight || this.state.detectedRowHeight || DEFAULT_ROW_HEIGHT;
    }
    getViewportHeight() {
        return this.props.viewportHeight || DEFAULT_VIEWPORT_HEIGHT;

    }
    getRecords() {
        return this.props.records;
    }
    handleWindowResize() {
        this.handleScroll();
        setTimeout(this.handleScroll.bind(this), 100);
    }
    componentDidMount() {
        this.queueSliceViewport(this.getRecords());

        this.resizeHandler = this.handleWindowResize.bind(this);
        window.addEventListener("resize", this.resizeHandler);

        this.tableDidMount();
    }
    componentWillUnmount() {
        window.removeEventListener("resize", this.resizeHandler);

        this.tableWillUnmount();
    }
    tableDidMount() {}
    tableWillUnmount() {}
    sliceViewport(records=[]) {
        let viewport = this.refs.viewport;
        if (!viewport) {
            return;
        }
        let scrollTop = viewport.scrollTop;
        let scrollHeight = viewport.scrollHeight;

        let viewportHeight = this.props.viewportHeight || DEFAULT_VIEWPORT_HEIGHT;
        let scrollBottom = scrollTop + viewportHeight;

        let topPercent = scrollHeight ? (scrollTop / scrollHeight) : 0;
        let bottomPercent = scrollHeight ? (scrollBottom / scrollHeight) : 0;

        let overflow = this.props.overflowRecords || DEFAULT_OVERFLOW_RECORDS
        let numberOfRecords = records.length;
        let topIndex = Math.max(0, Math.floor(topPercent * numberOfRecords) - overflow);
        let bottomIndex = Math.min(records.length, Math.ceil(bottomPercent * numberOfRecords) + overflow);

        let viewportRecords = records.slice(topIndex, bottomIndex);
        this.setState({
            scrollTop,
            scrollHeight,
            topIndex,
            viewportRecords
        });
    }
    queueUpdateExternals() {
        this.updateExternals();
    }
    updateExternals() {
        this.time("Update Externals");
        // TODO check header and footer exist first
        let externals = [];
        let header = this.refs.header;
        if (header) {
            externals.push(header);
        }
        let footer = this.refs.footer;
        if (footer) {
            externals.push(footer);
        }

        let body = this.refs.body;
        if (!body) {
            return;
        }
        let bodyRows = body.getElementsByTagName("tr");
        let firstRow = bodyRows.length ? bodyRows[0] : null;

        // Do nothing
        if (firstRow === null) {
            return;
        }

        let firstRowColumns = firstRow.getElementsByTagName("td");
        // FIXME do not use lodash
        let widths = _.map(firstRowColumns, (column) => {
            return column.offsetWidth;
        });

        let records = this.getRecords();
        let recordsAreAvailable = records.length !== 0;

        _.each(externals, (external) => {
            let columns = external.getElementsByTagName("th");
            let index = 0;
            _.each(columns, (column) => {
                if (!recordsAreAvailable) {
                    delete column.style.width;
                    delete column.style.display;
                    delete column.style.overflowX;
                    delete column.style.textOverflow;
                    return;
                }

                let count = column.getAttribute("colspan");
                count = count ? parseInt(count, 10) : 1;

                let width = 0;
                for (let y = 0; y < count; y++) {
                    let columnIndex = index + y;
                    let value = widths[columnIndex];
                    if (!isNaN(value)) {
                        width += value;
                    }
                }

                column.style.width = width + "px";
                column.style.display = "inline-block";
                column.style.overflowX = "hidden";
                column.style.textOverflow = "ellipsis";

                index += count;
            });
        });

        this.timeEnd("Update Externals");
    }
    componentWillReceiveProps(nextProps) {
        this.queueSliceViewport(nextProps.records);

        // After the above slice, sometimes the scroller gets stuck.
        // FIXME This may have to do with the anchor
        setTimeout(this.handleScroll.bind(this));
    }
    queueSliceViewport(records) {
        this.time("Slice Viewport");
        let self = this;
        // window.requestAnimationFrame(() => {
        self.sliceViewport(records);
        // });
        this.timeEnd("Slice Viewport");
    }
    handleScroll() {
        this.queueSliceViewport(this.getRecords());
    }
    getBodyStyle() {
        return {
            width: this.props.width || "100%"
        };
    }
    renderHeader() {
        if (!this.props.headerComponent) {
            return null;
        }
        return (
            <thead>
                { React.createElement(this.props.headerComponent, this.props) }
            </thead>
        );
    }
    renderFooter() {
        if (!this.props.footerComponent) {
            return null;
        }
        return (
            <tfoot>
                { React.createElement(this.props.footerComponent, this.props) }
            </tfoot>
        );
    }
    renderEmpty() {
        return React.createElement(this.props.emptyComponent, this.props);
    }
    renderRecords(records) {
        let self = this;
        return records.map((record) => {
            return this.renderRecord.call(self, record);
        });
    }
    renderRecord(record) {
        return React.createElement(this.props.recordComponent, { ...this.props, record, key: record.id });
    }
    componentWillUpdate() {
        this.time("Update");
    }
    render() {
        this.time("Render");
        let recordComponents;
        let allRecords = this.getRecords() || [];
        let rowHeight = this.getRowHeight();
        let topIndex = this.state.topIndex;
        let anchorTop = topIndex * rowHeight;
        let viewportRecords = this.state.viewportRecords;

        let scaffoldHeight = allRecords.length * rowHeight;
        let scaffoldStyles = {
            height: scaffoldHeight + "px"
        };

        let anchorStyles = {
            position: "absolute",
            left: "0px",
            width: "100%",
            top: anchorTop + "px"
        };

        let viewportHeight = this.props.viewportHeight || DEFAULT_VIEWPORT_HEIGHT;
        let viewportStyles = {
            position: "relative",
            height: viewportHeight + "px",
            overflowY: "auto",
            overflowX: "hidden"
        };

        let bodyStyles = {
            width: "100%"
        };

        if (allRecords.length === 0) {
            recordComponents = this.renderEmpty();
        } else {
            recordComponents = this.renderRecords(viewportRecords);
        }

        let result = (
            <div className="infinite-scroll" ref="container">
                <div className="infinite-scroll-header">
                    <table className={ this.props.className } ref="header">
                        { this.renderHeader() }
                    </table>
                </div>
                <div className="infinite-scroll-viewport" ref="viewport" style={ viewportStyles } onScroll={ this.handleScroll.bind(this) }>
                    <div className="infinite-scroll-scaffold" ref="scaffold" style={ scaffoldStyles }></div>
                    <div className="infinite-scroll-anchor" ref="anchor" style={ anchorStyles }>
                        <table ref="body" style={ bodyStyles } className={ this.props.className }>
                            <tbody key="infinite-scroll-body">
                                { recordComponents }
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="infinite-scroll-footer">
                    <table className={ this.props.className || "" } ref="footer">
                        { this.renderFooter() }
                    </table>
                </div>
            </div>
        );
        this.timeEnd("Render");
        return result;
    }
    componentDidUpdate() {
        this.timeEnd("Update");
        this.queueUpdateExternals();
        this.updateRowHeight();
    }
    updateRowHeight() {
        // Do not detect the rowHeight if it's provided
        if (this.props.rowHeight) {
            return;
        }
        let rows = this.refs.body.getElementsByTagName("tr");

        // Can't detect rows that don't exist
        if (rows.length === 0) {
            return;
        }

        let detectedRowHeight = rows[0].clientHeight;
        _.each(rows, (row) => {
            detectedRowHeight = Math.min(detectedRowHeight, row.clientHeight);
        });

        if (this.state.detectedRowHeight !== detectedRowHeight) {
            this.setState({
                detectedRowHeight
            });
        }
    }
    getTimeMessage(message) {
        return `InfiniteScroll #${this.uniqueId} - ${message}`
    }
    time(message) {
        if (this.props.debug && console.time) {
            console.time(this.getTimeMessage(message));
        }
    }
    timeEnd(message) {
        if (this.props.debug && console.timeEnd) {
            console.timeEnd(this.getTimeMessage(message));
        }
    }
}
